// 06_seguridad.js
// Semana 5: seguridad, privacidad y minimización de salida.
//
// Objetivo:
// Demostrar una salida minimizada para un rol de consulta,
// devolviendo únicamente los campos necesarios para el análisis.

var curso = db.getSiblingDB("m6_nosql");
var coleccion = curso.cambios_uso_suelo;

if (coleccion.countDocuments({}) !== 50000) {
  throw new Error("Carga primero los datos con scripts/01_carga_datos.sh");
}

print("=== Semana 5: salida minimizada ===");

var filtro = {
  usoActual: "Asentamientos humanos"
};

var proyeccion = {
  _id: 0,
  usoPrevio: 1,
  usoActual: 1,
  superficie: 1,
  "cambio.tasa": 1,
  alcaldias: 1
};

var resultado = coleccion
  .find(filtro, proyeccion)
  .limit(5)
  .toArray();

printjson(resultado);

if (resultado.length === 0) {
  throw new Error("La consulta minimizada no devolvió documentos.");
}

// Verifica que no se exponga la geometría completa.
if (
  resultado.some(function (documento) {
    return documento.geometria !== undefined;
  })
) {
  throw new Error("La salida minimizada no debe incluir geometria.");
}

print("");
print("Documentos mostrados: " + resultado.length);
print("La geometria completa fue excluida de la salida.");
print("La consulta conserva únicamente los campos necesarios para el análisis.");
