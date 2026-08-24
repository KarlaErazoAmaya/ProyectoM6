// 02_consultas_base.js
// Medicion inicial de los patrones de consulta, antes de crear indices
// secundarios. Guia de avance, semana 2, seccion 3.3.
//
// Ejecucion:
//   ~/m6-nosql/.tools/bin/mongosh "mongodb://127.0.0.1:27017/m6_nosql" \
//     --quiet scripts/02_consultas_base.js > evidencias/medicion_inicial.txt
//
// El script elimina los indices secundarios antes de medir, de modo que la
// linea base parte siempre del mismo estado y puede repetirse.

var curso = db.getSiblingDB("m6_nosql");
var coleccion = curso.cambios_uso_suelo;

if (coleccion.countDocuments({}) !== 50000) {
  throw new Error("Carga primero los datos con scripts/01_carga_datos.sh");
}

// --- Estado conocido: solo el indice _id_ -------------------------------

coleccion.getIndexes().forEach(function (indice) {
  if (indice.name !== "_id_") {
    coleccion.dropIndex(indice.name);
  }
});

print("=== Indices disponibles ===");
coleccion.getIndexes().forEach(function (indice) {
  print("  " + indice.name);
});

// --- Patrones de consulta seleccionados ---------------------------------

var consultas = [
  {
    clave: "A",
    pregunta: "Que transiciones hacia asentamientos humanos presentan las " +
              "tasas de cambio mas altas",
    filtro: { usoActual: "Asentamientos humanos" },
    orden: { "cambio.tasa": -1 }
  },
  {
    clave: "B",
    pregunta: "Que superficie de agricultura de temporal se transformo en " +
              "asentamientos humanos con tasas superiores al 5 por ciento",
    filtro: {
      usoActual: "Asentamientos humanos",
      usoPrevio: "Agricultura de temporal",
      "cambio.tasa": { $gte: 5 }
    },
    orden: null
  },
  {
    clave: "C",
    pregunta: "Que transiciones hacia asentamientos humanos afectan a una " +
              "alcaldia determinada",
    filtro: {
      usoActual: "Asentamientos humanos",
      alcaldias: "Xochimilco"
    },
    orden: null
  }
];

// --- Extraccion de metricas ---------------------------------------------

// Recorre el arbol de etapas y devuelve sus nombres, de la mas externa a la
// mas interna. Permite reconocer una etapa SORT independiente.
function etapas(plan) {
  var nombres = [];
  var actual = plan;
  while (actual) {
    nombres.push(actual.stage);
    actual = actual.inputStage;
  }
  return nombres;
}

function medir(consulta) {
  var cursor = coleccion.find(consulta.filtro);
  if (consulta.orden) {
    cursor = cursor.sort(consulta.orden);
  }
  var salida = cursor.explain("executionStats");
  var lista = etapas(salida.queryPlanner.winningPlan);
  var stats = salida.executionStats;

  return {
    clave: consulta.clave,
    plan: lista.join(" <- "),
    sortIndependiente: lista.indexOf("SORT") !== -1,
    nReturned: stats.nReturned,
    totalKeysExamined: stats.totalKeysExamined,
    totalDocsExamined: stats.totalDocsExamined,
    milisegundos: stats.executionTimeMillis,
    completo: salida
  };
}

// --- Ejecucion -----------------------------------------------------------

var resultados = [];

consultas.forEach(function (consulta) {
  var medicion = medir(consulta);
  resultados.push(medicion);

  print("");
  print("=== Consulta " + consulta.clave + " ===");
  print("Pregunta: " + consulta.pregunta);
  print("Filtro: " + JSON.stringify(consulta.filtro));
  print("Orden: " + (consulta.orden ? JSON.stringify(consulta.orden) : "ninguno"));
  print("");
  print("  Plan.................. " + medicion.plan);
  print("  Etapa SORT aparte..... " + (medicion.sortIndependiente ? "si" : "no"));
  print("  nReturned............. " + medicion.nReturned);
  print("  totalKeysExamined..... " + medicion.totalKeysExamined);
  print("  totalDocsExamined..... " + medicion.totalDocsExamined);
  print("  executionTimeMillis... " + medicion.milisegundos);
  print("");
  print("--- explain completo ---");
  printjson(medicion.completo);
});

// --- Resumen -------------------------------------------------------------

print("");
print("=== Resumen de la medicion inicial ===");
print("Consulta | Plan                | SORT | Devueltos | Claves | Documentos");
resultados.forEach(function (r) {
  print("   " + r.clave + "     | " + r.plan +
        " | " + (r.sortIndependiente ? " si " : " no ") +
        " | " + r.nReturned +
        " | " + r.totalKeysExamined +
        " | " + r.totalDocsExamined);
});

// --- Comprobaciones ------------------------------------------------------

resultados.forEach(function (r) {
  if (r.totalKeysExamined !== 0) {
    throw new Error("La consulta " + r.clave + " uso un indice: la medicion " +
                    "inicial debe ejecutarse sin indices secundarios.");
  }
  if (r.totalDocsExamined !== 50000) {
    throw new Error("La consulta " + r.clave + " no recorrio la coleccion " +
                    "completa; revisa el estado de partida.");
  }
});

print("");
print("Las tres consultas recorrieron la coleccion completa sin indice.");
print("Conserva estos valores: son la referencia de 03_indices.js");
