// 03_indices.js
// Creacion de los indices y medicion posterior. Guia de avance, semana 2,
// secciones 3.4 y 3.5.
//
// Ejecucion:
//   ~/m6-nosql/.tools/bin/mongosh "mongodb://127.0.0.1:27017/m6_nosql" \
//     --quiet scripts/03_indices.js > evidencias/medicion_posterior.txt
//
// Las consultas conservan exactamente la forma que tenian en
// 02_consultas_base.js. Solo cambia el conjunto de indices disponibles, de
// modo que las diferencias son atribuibles a esa decision.
//
// El script elimina los indices secundarios antes de crearlos, por lo que dos
// ejecuciones consecutivas producen el mismo estado.

var curso = db.getSiblingDB("m6_nosql");
var coleccion = curso.cambios_uso_suelo;

if (coleccion.countDocuments({}) !== 50000) {
  throw new Error("Carga primero los datos con scripts/01_carga_datos.sh");
}

// --- Valores de referencia obtenidos en 02_consultas_base.js -------------

var referencia = {
  A: { nReturned: 14347, docsExaminados: 50000, sortAparte: true },
  B: { nReturned: 1880, docsExaminados: 50000, sortAparte: false },
  C: { nReturned: 1196, docsExaminados: 50000, sortAparte: false }
};

// --- Estado conocido ------------------------------------------------------

// Se preserva geometria_2dsphere: pertenece al componente geoespacial y
// responde a un patron de consulta distinto del de los indices convencionales.
coleccion.getIndexes().forEach(function (indice) {
  if (indice.name !== "_id_" && indice.name !== "geometria_2dsphere") {
    coleccion.dropIndex(indice.name);
  }
});

// --- Indices --------------------------------------------------------------
//
// uso_tasa        apoya la consulta B. Dos igualdades seguidas del campo de
//                 rango, segun el criterio igualdad -> ordenamiento -> rango.
// uso_tasa_orden  apoya la consulta A. Coloca cambio.tasa inmediatamente
//                 despues de la igualdad para que el indice entregue el orden
//                 ya resuelto y desaparezca la etapa SORT.
// uso_alcaldias   apoya la consulta C. Multikey por el arreglo alcaldias; la
//                 igualdad precede al arreglo para acotar antes de recorrerlo.

coleccion.createIndex(
  { usoActual: 1, usoPrevio: 1, "cambio.tasa": -1 },
  { name: "uso_tasa" }
);

coleccion.createIndex(
  { usoActual: 1, "cambio.tasa": -1 },
  { name: "uso_tasa_orden" }
);

coleccion.createIndex(
  { usoActual: 1, alcaldias: 1 },
  { name: "uso_alcaldias" }
);

print("=== Indices creados ===");
printjson(coleccion.getIndexes());

print("");
print("=== Tamano de los indices (bytes) ===");
printjson(coleccion.stats().indexSizes);

// --- Consultas, identicas a las de la medicion inicial --------------------

var consultas = [
  {
    clave: "A",
    filtro: { usoActual: "Asentamientos humanos" },
    orden: { "cambio.tasa": -1 }
  },
  {
    clave: "B",
    filtro: {
      usoActual: "Asentamientos humanos",
      usoPrevio: "Agricultura de temporal",
      "cambio.tasa": { $gte: 5 }
    },
    orden: null
  },
  {
    clave: "C",
    filtro: {
      usoActual: "Asentamientos humanos",
      alcaldias: "Xochimilco"
    },
    orden: null
  }
];

function etapas(plan) {
  var nombres = [];
  var actual = plan;
  while (actual) {
    nombres.push(actual.stage);
    actual = actual.inputStage;
  }
  return nombres;
}

// Busca el nombre del indice empleado dentro del arbol de etapas.
function indiceUsado(plan) {
  var actual = plan;
  while (actual) {
    if (actual.indexName) {
      return actual.indexName;
    }
    actual = actual.inputStage;
  }
  return "ninguno";
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
    indice: indiceUsado(salida.queryPlanner.winningPlan),
    sortIndependiente: lista.indexOf("SORT") !== -1,
    planesDescartados: salida.queryPlanner.rejectedPlans.length,
    nReturned: stats.nReturned,
    totalKeysExamined: stats.totalKeysExamined,
    totalDocsExamined: stats.totalDocsExamined,
    milisegundos: stats.executionTimeMillis,
    completo: salida
  };
}

var resultados = [];

consultas.forEach(function (consulta) {
  var medicion = medir(consulta);
  resultados.push(medicion);

  print("");
  print("=== Consulta " + medicion.clave + " ===");
  print("  Plan.................. " + medicion.plan);
  print("  Indice................ " + medicion.indice);
  print("  Etapa SORT aparte..... " + (medicion.sortIndependiente ? "si" : "no"));
  print("  Planes descartados.... " + medicion.planesDescartados);
  print("  nReturned............. " + medicion.nReturned);
  print("  totalKeysExamined..... " + medicion.totalKeysExamined);
  print("  totalDocsExamined..... " + medicion.totalDocsExamined +
        "  (antes: " + referencia[medicion.clave].docsExaminados + ")");
  print("  executionTimeMillis... " + medicion.milisegundos);
  print("");
  print("--- explain completo ---");
  printjson(medicion.completo);
});

// --- Comparacion ----------------------------------------------------------

print("");
print("=== Comparacion antes y despues ===");
print("Consulta | Indice          | Docs antes | Docs despues | Reduccion | Devueltos");
resultados.forEach(function (r) {
  var antes = referencia[r.clave].docsExaminados;
  var reduccion = Math.round((1 - r.totalDocsExamined / antes) * 1000) / 10;
  print("   " + r.clave + "     | " + r.indice +
        " | " + antes +
        " | " + r.totalDocsExamined +
        " | " + reduccion + " %" +
        " | " + r.nReturned);
});

// --- Comprobaciones -------------------------------------------------------
//
// La condicion decisiva no es que las metricas mejoren, sino que el conjunto
// de resultados no haya cambiado. Un indice que altera la salida invalida la
// comparacion aunque reduzca el trabajo.

resultados.forEach(function (r) {
  if (r.nReturned !== referencia[r.clave].nReturned) {
    throw new Error("La consulta " + r.clave + " devolvio " + r.nReturned +
                    " documentos y antes devolvia " +
                    referencia[r.clave].nReturned +
                    ": el indice altero el resultado.");
  }
  if (r.totalKeysExamined === 0) {
    throw new Error("La consulta " + r.clave + " no uso ningun indice.");
  }
});

if (resultados[0].sortIndependiente) {
  throw new Error("La consulta A conserva una etapa SORT independiente: " +
                  "revisa el orden de los campos de uso_tasa_orden.");
}

print("");
print("Los resultados coinciden con la medicion inicial en las tres consultas.");
print("La consulta A resuelve el ordenamiento con el indice, sin etapa SORT.");
