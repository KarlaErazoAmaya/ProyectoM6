#!/usr/bin/env bash
# Carga el conjunto sintetico en la coleccion cambios_uso_suelo.
#
# Uso:
#   bash 01_carga_datos.sh                  # instancia local del Learner Lab
#   MONGO_URI="mongodb://host:27017/m6_nosql" bash 01_carga_datos.sh
#
# El script es idempotente: elimina la coleccion antes de cargar, de modo
# que dos ejecuciones consecutivas producen el mismo estado.

set -eu

ARCHIVO="${ARCHIVO:-cambios_uso_suelo_sintetico.json}"
COLECCION="${COLECCION:-cambios_uso_suelo}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/m6_nosql?directConnection=true}"

if [ ! -f "$ARCHIVO" ]; then
  echo "ERROR: no se encontro $ARCHIVO en $(pwd)." >&2
  exit 1
fi

# Localiza las herramientas: primero las del repositorio del curso,
# despues las del PATH del sistema.
buscar() {
  if [ -x "./.tools/bin/$1" ]; then echo "./.tools/bin/$1"
  elif command -v "$1" >/dev/null 2>&1; then command -v "$1"
  else echo ""
  fi
}

MONGOIMPORT=$(buscar mongoimport)
MONGOSH=$(buscar mongosh)
[ -z "$MONGOSH" ] && MONGOSH=$(buscar mongo)

if [ -n "$MONGOIMPORT" ]; then
  echo "Cargando con mongoimport..."
  "$MONGOIMPORT" --uri "$MONGO_URI" \
    --collection "$COLECCION" \
    --file "$ARCHIVO" \
    --drop
elif [ -n "$MONGOSH" ]; then
  # Alternativa cuando mongoimport no esta disponible en el entorno.
  # Inserta por lotes de 1000 para no agotar la memoria del shell.
  echo "mongoimport no disponible; cargando con $MONGOSH por lotes..."
  "$MONGOSH" "$MONGO_URI" --quiet --eval "
    var fs = require('fs');
    var lineas = fs.readFileSync('$ARCHIVO', 'utf8').split('\n');
    db.$COLECCION.drop();
    var lote = [], insertados = 0;
    for (var i = 0; i < lineas.length; i++) {
      if (!lineas[i]) continue;
      lote.push(JSON.parse(lineas[i]));
      if (lote.length === 1000) {
        db.$COLECCION.insertMany(lote);
        insertados += lote.length; lote = [];
      }
    }
    if (lote.length) { db.$COLECCION.insertMany(lote); insertados += lote.length; }
    print('Insertados: ' + insertados);
  "
else
  echo "ERROR: no se encontro mongoimport ni un shell de MongoDB." >&2
  exit 1
fi

echo ""
echo "=== Comprobacion ==="
"$MONGOSH" "$MONGO_URI" --quiet --eval "
  print('Documentos: ' + db.$COLECCION.countDocuments({}));
  print('Hacia asentamientos humanos: ' +
    db.$COLECCION.countDocuments({ usoActual: 'Asentamientos humanos' }));
  print('Con uso nulo: ' + db.$COLECCION.countDocuments({ usoActual: null }));
  print('Indices iniciales: ' + db.$COLECCION.getIndexes().length);
"
