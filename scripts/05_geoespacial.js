// 05_geoespacial.js
// Componente geoespacial: indice 2dsphere, casos de control y pipeline de
// indicadores. Guia de avance, semana 3, secciones 3.4 a 3.8.
//
// Ejecucion:
//   ~/m6-nosql/.tools/bin/mongosh "mongodb://127.0.0.1:27017/m6_nosql" \
//     --quiet scripts/05_geoespacial.js | tee evidencias/geoespacial.txt
//
// Debe ejecutarse DESPUES de 03_indices.js, porque aquel elimina los indices
// secundarios antes de crear los suyos y borraria el indice geoespacial.
//
// El script inserta cuatro casos de control, los comprueba y los elimina, de
// modo que la coleccion vuelve a su estado original y puede repetirse.

var curso = db.getSiblingDB("m6_nosql");
var transiciones = curso.cambios_uso_suelo;
var zonasColeccion = curso.zonas_conservacion;

if (transiciones.countDocuments({}) !== 50000) {
  throw new Error("Carga primero los datos con scripts/01_carga_datos.sh");
}
if (zonasColeccion.countDocuments({}) !== 3) {
  throw new Error("Faltan las zonas de conservacion. Ejecuta 01_carga_datos.sh");
}

// --- Estado de partida ----------------------------------------------------

print("=== Estado de partida ===");
print("  Transiciones................... " + transiciones.countDocuments({}));
print("  Con geometria utilizable....... " +
      transiciones.countDocuments({ geometria: { $exists: true } }));
print("  Zonas de conservacion.......... " + zonasColeccion.countDocuments({}));

// --- Indice geoespacial ---------------------------------------------------
//
// El indice se crea sobre la coleccion que se filtra. Las zonas NO se indexan:
// en una consulta $geoIntersects el indice que trabaja es el de la coleccion
// filtrada, no el de la geometria de referencia, y tres documentos caben en
// memoria sin costo. Cada indice debe derivarse de una pregunta, y ninguna
// consulta del proyecto recorre las zonas.

transiciones.createIndex({ geometria: "2dsphere" }, { name: "geometria_2dsphere" });

print("");
print("=== Indices de cambios_uso_suelo ===");
transiciones.getIndexes().forEach(function (indice) {
  print("  " + indice.name + "  " + JSON.stringify(indice.key));
});

var tieneGeo = transiciones.getIndexes().some(function (i) {
  return i.name === "geometria_2dsphere";
});
if (!tieneGeo) {
  throw new Error("No se creo el indice geoespacial.");
}

// --- Casos de control -----------------------------------------------------
//
// Cuatro transiciones cuya ubicacion respecto de ZC-01 se conoce de antemano.
// Comprueban el operador antes de aplicarlo al conjunto completo.

var zona = zonasColeccion.findOne({ _id: "ZC-01" }).geometria;

print("");
print("=== Geometria de referencia ===");
print("  Zona.......... ZC-01, " + zonasColeccion.findOne({ _id: "ZC-01" }).nombre);
print("  Tipo.......... " + zona.type);
print("  Vertices...... " + zona.coordinates[0].length);
print("  Anillo cerrado " +
      (JSON.stringify(zona.coordinates[0][0]) ===
       JSON.stringify(zona.coordinates[0][zona.coordinates[0].length - 1])));

function cuadro(lon, lat) {
  var lado = 0.012;
  return {
    type: "Polygon",
    coordinates: [[
      [lon, lat],
      [lon + lado, lat],
      [lon + lado, lat + lado],
      [lon, lat + lado],
      [lon, lat]
    ]]
  };
}

function control(id, geometria, usoActual) {
  return {
    _id: id,
    usoPrevio: "Agricultura de temporal",
    usoActual: usoActual,
    superficie: {
      usoPrevioHa: 210.5, usoActualHa: 244.8, areaTransicionM2: 2105000.5
    },
    cambio: {
      descripcion: "Agricultura de temporal -" + usoActual,
      tasa: 6.4,
      clasificacionUso: usoActual === "Asentamientos humanos" ? 5 : 3,
      clasificacionTasa: 4
    },
    referencias: { serieInicialId: 2, serieFinalId: 5 },
    alcaldias: ["Tlalpan"],
    longitudGeometria: 5300.5,
    geometria: geometria
  };
}

var casos = [
  { doc: control(990001, cuadro(-99.14, 19.14), "Asentamientos humanos"),
    ubicacion: "contenida en ZC-01",
    intersects: true, within: true, tematico: true },
  { doc: control(990002, cuadro(-99.20, 19.288), "Asentamientos humanos"),
    ubicacion: "cruza el borde norte",
    intersects: true, within: false, tematico: true },
  { doc: control(990003, cuadro(-99.14, 19.48), "Asentamientos humanos"),
    ubicacion: "al norte, lejos de toda zona",
    intersects: false, within: false, tematico: false },
  { doc: control(990004, cuadro(-99.10, 19.12), "Vegetación secundaria"),
    ubicacion: "contenida en ZC-01, uso posterior distinto",
    intersects: true, within: true, tematico: false }
];

transiciones.deleteMany({ _id: { $gte: 990000 } });
casos.forEach(function (caso) { transiciones.insertOne(caso.doc); });

function ids(cursor) {
  return cursor.toArray().map(function (d) { return d._id; }).sort();
}

var conIntersects = ids(transiciones.find(
  { _id: { $gte: 990000 }, geometria: { $geoIntersects: { $geometry: zona } } },
  { _id: 1 }
));

var conWithin = ids(transiciones.find(
  { _id: { $gte: 990000 }, geometria: { $geoWithin: { $geometry: zona } } },
  { _id: 1 }
));

var conTematico = ids(transiciones.find(
  { _id: { $gte: 990000 },
    usoActual: "Asentamientos humanos",
    geometria: { $geoIntersects: { $geometry: zona } } },
  { _id: 1 }
));

print("");
print("=== Casos de control ===");
print("  $geoIntersects............... " + conIntersects.join(", "));
print("  $geoWithin................... " + conWithin.join(", "));
print("  $geoIntersects + tematico.... " + conTematico.join(", "));

var fallos = 0;
casos.forEach(function (caso) {
  var id = caso.doc._id;
  var obtenido = {
    intersects: conIntersects.indexOf(id) !== -1,
    within: conWithin.indexOf(id) !== -1,
    tematico: conTematico.indexOf(id) !== -1
  };
  var correcto = obtenido.intersects === caso.intersects &&
                 obtenido.within === caso.within &&
                 obtenido.tematico === caso.tematico;
  if (!correcto) { fallos = fallos + 1; }

  print("");
  print("  " + id + "  (" + caso.ubicacion + ")");
  print("    $geoIntersects.. esperado " + caso.intersects +
        ", obtenido " + obtenido.intersects);
  print("    $geoWithin...... esperado " + caso.within +
        ", obtenido " + obtenido.within);
  print("    con tematico.... esperado " + caso.tematico +
        ", obtenido " + obtenido.tematico);
  print("    resultado....... " + (correcto ? "correcto" : "NO COINCIDE"));
});

// El caso 990002 es el unico que distingue ambos operadores: si apareciera con
// los dos, o con ninguno, el operador no representaria la relacion esperada.
if (conIntersects.length === conWithin.length) {
  throw new Error("$geoIntersects y $geoWithin devolvieron lo mismo: los " +
                  "casos de control no distinguen ambos operadores.");
}

transiciones.deleteMany({ _id: { $gte: 990000 } });

if (transiciones.countDocuments({}) !== 50000) {
  throw new Error("La coleccion no volvio a su estado original.");
}

if (fallos > 0) {
  throw new Error(fallos + " caso(s) de control no coincidieron con lo esperado.");
}

// --- Seleccion sobre el conjunto completo ---------------------------------
//
// La consulta se construye progresivamente: primero la seleccion espacial,
// despues los filtros tematicos, y solo entonces la agrupacion.

var zonas = zonasColeccion.find({}, { geometria: 1 }).toArray()
  .map(function (z) {
    return { geometria: { $geoIntersects: { $geometry: z.geometria } } };
  });

// El $or evita que un documento que tocara dos zonas se contara dos veces.
var soloEspacial = { $or: zonas };
var conUso = { $or: zonas, usoActual: "Asentamientos humanos" };

// La exclusion de usoPrevio no es cosmetica: sin ella la seleccion incluye
// registros cuyo uso previo y posterior coinciden, que no son
// transformaciones sino superficies que ya eran urbanas.
var filtro = {
  $or: zonas,
  usoActual: "Asentamientos humanos",
  usoPrevio: { $ne: "Asentamientos humanos" }
};

var nEspacial = transiciones.countDocuments(soloEspacial);
var nWithin = transiciones.countDocuments({
  $or: zonasColeccion.find({}, { geometria: 1 }).toArray().map(function (z) {
    return { geometria: { $geoWithin: { $geometry: z.geometria } } };
  })
});
var nConUso = transiciones.countDocuments(conUso);
var nFiltro = transiciones.countDocuments(filtro);

print("");
print("=== Seleccion progresiva ===");
print("  Intersectan alguna zona................. " + nEspacial);
print("  Contenidas por completo................. " + nWithin);
print("    diferencia (cruzan el borde).......... " + (nEspacial - nWithin));
print("  Intersectan y son hacia asentamientos... " + nConUso);
print("  Excluyendo uso previo ya urbano......... " + nFiltro);
print("    excluidos (sin cambio real)........... " + (nConUso - nFiltro));

// --- Pipeline de indicadores ----------------------------------------------
//
// Unidad de analisis: el uso de suelo previo, acotado a las transiciones que
// intersectan alguna zona y cuyo uso posterior es asentamientos humanos.

var pipeline = [
  { $match: filtro },
  { $group: {
      _id: "$usoPrevio",
      transiciones: { $sum: 1 },
      superficieTotalHa: { $sum: "$superficie.usoPrevioHa" },
      tasaPromedio: { $avg: "$cambio.tasa" },
      tasaMinima: { $min: "$cambio.tasa" },
      tasaMaxima: { $max: "$cambio.tasa" }
  } },
  { $project: {
      _id: 0,
      usoPrevio: "$_id",
      transiciones: 1,
      superficieTotalHa: { $round: ["$superficieTotalHa", 2] },
      tasaPromedio: { $round: ["$tasaPromedio", 2] },
      tasaMinima: { $round: ["$tasaMinima", 2] },
      tasaMaxima: { $round: ["$tasaMaxima", 2] }
  } },
  // Dos claves: $group no garantiza orden, y ante empate en el numero de
  // transiciones el nombre del uso previo lo desempata de forma determinista.
  { $sort: { transiciones: -1, usoPrevio: 1 } }
];

var resultado = transiciones.aggregate(pipeline).toArray();

print("");
print("=== Indicadores por uso previo ===");
print("  uso previo                       | transic. | superficie ha | tasa prom");
resultado.forEach(function (r) {
  print("  " + (r.usoPrevio + "                                ").substring(0, 32) +
        " | " + ("      " + r.transiciones).slice(-8) +
        " | " + ("             " + r.superficieTotalHa).slice(-13) +
        " | " + ("       " + r.tasaPromedio).slice(-9));
});

print("");
print("--- resultado completo ---");
printjson(resultado);

// --- Comprobaciones -------------------------------------------------------

var suma = 0;
resultado.forEach(function (r) { suma = suma + r.transiciones; });

if (suma !== nFiltro) {
  throw new Error("La suma de los grupos (" + suma + ") no coincide con la " +
                  "seleccion (" + nFiltro + ").");
}

if (resultado.length !== 7) {
  throw new Error("Se esperaban 7 grupos y se obtuvieron " + resultado.length);
}

print("");
print("Los cuatro casos de control se comportaron como se esperaba.");
print("La suma de los grupos coincide con la seleccion: " + suma + " documentos.");
print("");
print("LIMITE: los datos son sinteticos. Un conteo no es una tasa mientras no");
print("exista un denominador de exposicion, y una superposicion territorial no");
print("demuestra infraccion, responsabilidad ni causalidad.");
