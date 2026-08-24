#!/usr/bin/env bash
# Carga los datos del proyecto en MongoDB.
#
# Uso:
#   bash scripts/01_carga_datos.sh
#   MONGO_URI="mongodb://host:27017/m6_nosql" bash scripts/01_carga_datos.sh
#
# El script es idempotente: elimina cada coleccion antes de cargarla, de modo
# que dos ejecuciones consecutivas producen el mismo estado.
#
# NOTA SOBRE EL ENTORNO
# El Learner Lab no incluye mongoimport: .tools/bin contiene unicamente mongod
# y el shell, y ese shell es el cliente legacy de MongoDB 4.4, que no dispone
# de require(). La carga se realiza con cat() dentro del shell.
#
# cat() rechaza archivos grandes con el mensaje "file too big to load as a
# variable", por lo que el conjunto de 50 000 documentos se parte antes de
# cargarlo. Las zonas, por su tamano, se cargan en una sola operacion.

set -eu

RAIZ=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$RAIZ"

ARCHIVO_TRANSICIONES="${ARCHIVO_TRANSICIONES:-cambios_uso_suelo_sintetico.json}"
ARCHIVO_ZONAS="${ARCHIVO_ZONAS:-data/zonas_conservacion.json}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/m6_nosql}"
TROZOS="${TROZOS:-/tmp/trozos_uso_suelo}"
LINEAS_POR_TROZO=5000

if [ -x "$HOME/m6-nosql/.tools/bin/mongosh" ]; then
  SHELL_MONGO="$HOME/m6-nosql/.tools/bin/mongosh"
elif command -v mongosh >/dev/null 2>&1; then
  SHELL_MONGO=$(command -v mongosh)
elif command -v mongo >/dev/null 2>&1; then
  SHELL_MONGO=$(command -v mongo)
else
  echo "ERROR: no se encontro un shell de MongoDB." >&2
  echo "Inicia el entorno con: bash ~/m6-nosql/setup/conectar.sh" >&2
  exit 1
fi

ejecutar() {
  "$SHELL_MONGO" "$MONGO_URI" --quiet --eval "$1"
}

# Comprueba que el servidor responde antes de cargar nada. Sin esta
# comprobacion, un servidor detenido produce una espera prolongada sin
# explicacion.
if ! ejecutar 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
  echo "ERROR: MongoDB no responde en $MONGO_URI." >&2
  echo "Inicia el entorno con: bash ~/m6-nosql/setup/conectar.sh" >&2
  exit 1
fi

# --- Transiciones ---------------------------------------------------------

if [ ! -f "$ARCHIVO_TRANSICIONES" ]; then
  echo "ERROR: no se encontro $ARCHIVO_TRANSICIONES en $RAIZ." >&2
  echo "Descargalo de S3 o generalo con: python3 scripts/generar_sinteticos.py" >&2
  exit 1
fi

echo "Partiendo $ARCHIVO_TRANSICIONES en trozos de $LINEAS_POR_TROZO lineas..."
rm -rf "$TROZOS"
mkdir -p "$TROZOS"
split -l "$LINEAS_POR_TROZO" "$ARCHIVO_TRANSICIONES" "$TROZOS/parte_"

echo "Cargando transiciones..."
ejecutar 'db.cambios_uso_suelo.drop()' >/dev/null

for trozo in "$TROZOS"/parte_*; do
  ejecutar "
    var lineas = cat('$trozo').split('\n');
    var docs = [];
    for (var i = 0; i < lineas.length; i++) {
      if (lineas[i]) docs.push(JSON.parse(lineas[i]));
    }
    db.cambios_uso_suelo.insertMany(docs);
  " >/dev/null
  echo "  $(basename "$trozo")"
done

rm -rf "$TROZOS"

# --- Zonas de conservacion ------------------------------------------------

if [ ! -f "$ARCHIVO_ZONAS" ]; then
  echo "ERROR: no se encontro $ARCHIVO_ZONAS." >&2
  echo "Generalo con: python3 scripts/generar_zonas.py" >&2
  exit 1
fi

echo "Cargando zonas de conservacion..."
ejecutar "
  var lineas = cat('$ARCHIVO_ZONAS').split('\n');
  db.zonas_conservacion.drop();
  var docs = [];
  for (var i = 0; i < lineas.length; i++) {
    if (lineas[i]) docs.push(JSON.parse(lineas[i]));
  }
  db.zonas_conservacion.insertMany(docs);
" >/dev/null

# --- Comprobacion ---------------------------------------------------------

echo ""
echo "=== Comprobacion ==="
ejecutar "
  var transiciones = db.cambios_uso_suelo.countDocuments({});
  var zonas = db.zonas_conservacion.countDocuments({});
  print('Transiciones................. ' + transiciones);
  print('  hacia asentamientos humanos ' +
        db.cambios_uso_suelo.countDocuments({ usoActual: 'Asentamientos humanos' }));
  print('  con uso nulo............... ' +
        db.cambios_uso_suelo.countDocuments({ usoActual: null }));
  print('Zonas de conservacion........ ' + zonas);
  if (transiciones !== 50000) {
    throw new Error('Se esperaban 50000 transiciones y se cargaron ' + transiciones);
  }
  if (zonas !== 3) {
    throw new Error('Se esperaban 3 zonas y se cargaron ' + zonas);
  }
  print('');
  print('Carga completa. Siguiente paso: scripts/02_consultas_base.js');
