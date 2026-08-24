// 04_validador.js
// Reglas de calidad y pruebas del validador. Guia de avance, semana 2,
// secciones 3.6 y 3.7.
//
// Ejecucion:
//   ~/m6-nosql/.tools/bin/mongosh "mongodb://127.0.0.1:27017/m6_nosql" \
//     --quiet scripts/04_validador.js > evidencias/validador.txt
//
// El script aplica el validador, ejecuta siete casos de prueba y elimina los
// documentos de prueba al terminar, por lo que puede repetirse.

var curso = db.getSiblingDB("m6_nosql");
var coleccion = curso.cambios_uso_suelo;

if (coleccion.countDocuments({}) !== 50000) {
  throw new Error("Carga primero los datos con scripts/01_carga_datos.sh");
}

var CATEGORIAS = [
  "Agricultura de riego",
  "Agricultura de temporal",
  "Asentamientos humanos",
  "Cuerpos de agua",
  "Pastizal inducido o cultivado",
  "Plantaciones forestales",
  "Vegetación primaria",
  "Vegetación secundaria",
  null
];

// --- Comprobacion previa --------------------------------------------------
//
// Antes de aplicar la regla se verifica que los documentos existentes no la
// incumplan. Si alguno lo hiciera, habria que identificar la causa y decidir
// si corregirlo, transformarlo o excluirlo, dejando constancia del criterio.

print("=== Comprobacion previa sobre los documentos existentes ===");

var tasaNoNumerica = coleccion.countDocuments({
  "cambio.tasa": { $not: { $type: "double" } }
});
var alcaldiasVacias = coleccion.countDocuments({ alcaldias: { $size: 0 } });
var sinGeometria = coleccion.countDocuments({ geometria: { $exists: false } });
var usoFueraDeDominio = coleccion.countDocuments({
  usoActual: { $nin: CATEGORIAS }
});

print("  cambio.tasa no numerica....... " + tasaNoNumerica);
print("  alcaldias vacio............... " + alcaldiasVacias);
print("  sin geometria................. " + sinGeometria);
print("  usoActual fuera del dominio... " + usoFueraDeDominio);

if (tasaNoNumerica || alcaldiasVacias || sinGeometria || usoFueraDeDominio) {
  throw new Error("Existen documentos que incumplen la regla. Documenta la " +
                  "causa y la decision antes de aplicar el validador.");
}

// --- Validador ------------------------------------------------------------
//
// Los campos numericos admiten double, int y long. Los documentos cargados
// con mongoimport almacenan enteros como int, mientras que el shell los
// interpreta como double al escribirlos manualmente: exigir un unico tipo
// rechazaria documentos correctos en funcion del cliente que los escribe.

var esquema = {
  bsonType: "object",
  required: ["_id", "usoPrevio", "usoActual", "superficie", "cambio",
             "alcaldias", "geometria"],
  properties: {
    usoPrevio: { bsonType: ["string", "null"], enum: CATEGORIAS },
    usoActual: { bsonType: ["string", "null"], enum: CATEGORIAS },
    superficie: {
      bsonType: "object",
      required: ["usoPrevioHa", "usoActualHa", "areaTransicionM2"],
      properties: {
        usoPrevioHa: { bsonType: ["double", "int", "long"], minimum: 0 },
        usoActualHa: { bsonType: ["double", "int", "long"], minimum: 0 },
        areaTransicionM2: { bsonType: ["double", "int", "long"], minimum: 0 }
      }
    },
    cambio: {
      bsonType: "object",
      required: ["tasa", "clasificacionUso", "clasificacionTasa"],
      properties: {
        tasa: { bsonType: ["double", "int", "long"] },
        descripcion: { bsonType: ["string", "null"] },
        clasificacionUso: {
          bsonType: ["int", "long", "double"], minimum: 0, maximum: 5
        },
        clasificacionTasa: {
          bsonType: ["int", "long", "double"], minimum: 0, maximum: 5
        }
      }
    },
    alcaldias: {
      bsonType: "array", minItems: 1, items: { bsonType: "string" }
    },
    geometria: {
      bsonType: "object",
      required: ["type", "coordinates"],
      properties: {
        type: { enum: ["Polygon", "MultiPolygon"] },
        coordinates: { bsonType: "array" }
      }
    }
  }
};

// Nivel moderate mientras se comprueban los casos: exime a los documentos que
// ya fueran invalidos. Al final del script se eleva a strict.
curso.runCommand({
  collMod: "cambios_uso_suelo",
  validator: { $jsonSchema: esquema },
  validationLevel: "moderate",
  validationAction: "error"
});

print("");
print("=== Validador aplicado ===");
var info = curso.getCollectionInfos({ name: "cambios_uso_suelo" })[0];
print("  validationLevel....... " + info.options.validationLevel);
print("  validationAction...... " + info.options.validationAction);

// --- Geometria auxiliar para los casos de prueba --------------------------

function poligono(lon, lat) {
  return {
    type: "Polygon",
    coordinates: [[
      [lon, lat], [lon + 0.01, lat], [lon + 0.01, lat + 0.01],
      [lon, lat + 0.01], [lon, lat]
    ]]
  };
}

// --- Casos de prueba ------------------------------------------------------
//
// Cada documento invalido aisla una sola inconsistencia: el resto de sus
// campos cumple el esquema, de modo que el rechazo es atribuible a la regla
// indicada y no a una combinacion de errores.

var casos = [
  {
    nombre: "valido-01-completo",
    esperado: "aceptado",
    regla: "cumple el esquema completo",
    documento: {
      _id: 900001,
      usoPrevio: "Agricultura de riego",
      usoActual: "Asentamientos humanos",
      superficie: { usoPrevioHa: 300.5, usoActualHa: 340.2,
                    areaTransicionM2: 3005000.5 },
      cambio: { descripcion: "Agricultura de riego -Asentamientos humanos",
                tasa: 4.2, clasificacionUso: 5, clasificacionTasa: 4 },
      referencias: { serieInicialId: 1, serieFinalId: 3 },
      alcaldias: ["Xochimilco"],
      longitudGeometria: 5100.5,
      geometria: poligono(-99.10, 19.27)
    }
  },
  {
    nombre: "valido-02-usos-nulos",
    esperado: "aceptado",
    regla: "null admitido en usoPrevio, usoActual y cambio.descripcion",
    documento: {
      _id: 900002,
      usoPrevio: null,
      usoActual: null,
      superficie: { usoPrevioHa: 120.5, usoActualHa: 118.2,
                    areaTransicionM2: 1205000.5 },
      cambio: { descripcion: null, tasa: -0.9,
                clasificacionUso: 0, clasificacionTasa: 2 },
      referencias: { serieInicialId: 1, serieFinalId: 3 },
      alcaldias: ["Tlalpan"],
      longitudGeometria: 8400.5,
      geometria: poligono(-99.18, 19.28)
    }
  },
  {
    nombre: "invalido-01-falta-geometria",
    esperado: "rechazado",
    regla: "required incluye geometria",
    documento: {
      _id: 900003,
      usoPrevio: "Agricultura de riego",
      usoActual: "Asentamientos humanos",
      superficie: { usoPrevioHa: 300.5, usoActualHa: 340.2,
                    areaTransicionM2: 3005000.5 },
      cambio: { descripcion: "prueba", tasa: 4.2,
                clasificacionUso: 5, clasificacionTasa: 4 },
      alcaldias: ["Xochimilco"]
    }
  },
  {
    nombre: "invalido-02-superficie-negativa",
    esperado: "rechazado",
    regla: "minimum 0 en superficie.usoPrevioHa",
    documento: {
      _id: 900004,
      usoPrevio: "Pastizal inducido o cultivado",
      usoActual: "Asentamientos humanos",
      superficie: { usoPrevioHa: -15.5, usoActualHa: 90.2,
                    areaTransicionM2: 900000.5 },
      cambio: { descripcion: "prueba", tasa: 6.1,
                clasificacionUso: 5, clasificacionTasa: 4 },
      alcaldias: ["Milpa Alta"],
      geometria: poligono(-99.02, 19.16)
    }
  },
  {
    nombre: "invalido-03-categoria-inexistente",
    esperado: "rechazado",
    regla: "enum de usoActual no contiene la categoria",
    documento: {
      _id: 900005,
      usoPrevio: "Vegetación primaria",
      usoActual: "Zona industrial",
      superficie: { usoPrevioHa: 210.5, usoActualHa: 205.2,
                    areaTransicionM2: 2105000.5 },
      cambio: { descripcion: "prueba", tasa: -1.2,
                clasificacionUso: 3, clasificacionTasa: 2 },
      alcaldias: ["Tlalpan"],
      geometria: poligono(-99.21, 19.21)
    }
  },
  {
    nombre: "invalido-04-geometria-punto",
    esperado: "rechazado",
    regla: "enum de geometria.type admite solo Polygon y MultiPolygon",
    documento: {
      _id: 900006,
      usoPrevio: "Agricultura de temporal",
      usoActual: "Asentamientos humanos",
      superficie: { usoPrevioHa: 480.5, usoActualHa: 530.2,
                    areaTransicionM2: 4805000.5 },
      cambio: { descripcion: "prueba", tasa: 8.4,
                clasificacionUso: 5, clasificacionTasa: 4 },
      alcaldias: ["Tláhuac"],
      geometria: { type: "Point", coordinates: [-98.96, 19.27] }
    }
  },
  {
    nombre: "invalido-05-alcaldias-vacio",
    esperado: "rechazado",
    regla: "minItems 1 en alcaldias",
    documento: {
      _id: 900008,
      usoPrevio: "Pastizal inducido o cultivado",
      usoActual: "Asentamientos humanos",
      superficie: { usoPrevioHa: 60.5, usoActualHa: 75.2,
                    areaTransicionM2: 605000.5 },
      cambio: { descripcion: "prueba", tasa: 3.5,
                clasificacionUso: 5, clasificacionTasa: 4 },
      alcaldias: [],
      geometria: poligono(-99.05, 19.30)
    }
  }
];

print("");
print("=== Casos de prueba ===");

var fallos = 0;

casos.forEach(function (caso) {
  var obtenido;
  var codigo = "";
  try {
    coleccion.insertOne(caso.documento);
    obtenido = "aceptado";
  } catch (error) {
    obtenido = "rechazado";
    codigo = error.code ? " (codigo " + error.code + ")" : "";
  }

  var coincide = obtenido === caso.esperado;
  if (!coincide) {
    fallos = fallos + 1;
  }

  print("");
  print("  " + caso.nombre);
  print("    esperado.. " + caso.esperado);
  print("    obtenido.. " + obtenido + codigo);
  print("    regla..... " + caso.regla);
  print("    resultado. " + (coincide ? "correcto" : "NO COINCIDE"));
});

// --- Limpieza -------------------------------------------------------------

var borrados = coleccion.deleteMany({ _id: { $gte: 900000 } });

print("");
print("=== Limpieza ===");
print("  Documentos de prueba eliminados: " + borrados.deletedCount);
print("  Documentos en la coleccion: " + coleccion.countDocuments({}));

if (coleccion.countDocuments({}) !== 50000) {
  throw new Error("La coleccion no volvio a su estado original.");
}

if (fallos > 0) {
  throw new Error(fallos + " caso(s) de prueba no coincidieron con lo esperado.");
}

// --- Cierre ---------------------------------------------------------------
//
// Comprobado que los documentos existentes cumplen las reglas, el nivel se
// eleva a strict: moderate solo tiene sentido mientras haya documentos
// invalidos pendientes de migrar.

curso.runCommand({
  collMod: "cambios_uso_suelo",
  validationLevel: "strict"
});

var nivelFinal = curso.getCollectionInfos({ name: "cambios_uso_suelo" })[0]
                   .options.validationLevel;

print("");
print("Los siete casos coinciden con el resultado esperado.");
print("validationLevel final: " + nivelFinal);
