# Reglas de calidad y validación

Colección `cambios_uso_suelo` · 50 000 documentos · MongoDB Community 4.4.29

## Diccionario de campos

| Campo o ruta | Tipo BSON | Presencia | Restricción y justificación |
|---|---|---|---|
| `_id` | `int` | Obligatorio | Identificador de la transición, heredado de `OBJECTID` en la fuente |
| `usoPrevio` | `string` o `null` | Obligatorio | `enum` de las ocho categorías observadas, más `null` |
| `usoActual` | `string` o `null` | Obligatorio | Mismo `enum` y misma razón |
| `superficie` | `object` | Obligatorio | Subdocumento con las tres medidas de superficie |
| `superficie.usoPrevioHa` | numérico | Obligatorio | `minimum: 0` |
| `superficie.usoActualHa` | numérico | Obligatorio | `minimum: 0` |
| `superficie.areaTransicionM2` | numérico | Obligatorio | `minimum: 0` |
| `cambio` | `object` | Obligatorio | Subdocumento del cambio observado |
| `cambio.tasa` | numérico | Obligatorio | Sin cota: la fuente registra valores entre −18.36 y 25.29 |
| `cambio.descripcion` | `string` o `null` | Opcional | `null` cuando ambos usos son nulos |
| `cambio.clasificacionUso` | numérico entero | Obligatorio | Entre 0 y 5, como en la fuente |
| `cambio.clasificacionTasa` | numérico entero | Obligatorio | Entre 0 y 5 |
| `alcaldias` | `array` de `string` | Obligatorio | `minItems: 1`: toda transición ocurre en al menos una demarcación |
| `geometria` | `object` | Obligatorio | Objeto GeoJSON |
| `geometria.type` | `string` | Obligatorio | `enum: ["Polygon", "MultiPolygon"]` |
| `geometria.coordinates` | `array` | Obligatorio | Arreglo de anillos |
| `referencias` | `object` | Opcional | Identificadores de las series comparadas |
| `longitudGeometria` | numérico | Opcional | Perímetro; no participa en ninguna consulta seleccionada |

### Reglas estructurales y reglas del problema

`minimum: 0` en las tres medidas de superficie es una regla **estructural**: una
superficie negativa carece de sentido en cualquier dominio y no depende de esta
fuente ni de esta clasificación.

El `enum` de las ocho categorías de uso es una regla **del problema**: son las
que emplea esta clasificación de uso de suelo y vegetación. Otra fuente, u otra
edición de la misma, podría incorporar categorías distintas, y entonces la regla
tendría que actualizarse. Lo mismo aplica al intervalo 0–5 de las dos
clasificaciones.

`null` se admite en `usoPrevio`, `usoActual` y `cambio.descripcion` porque la
fuente real presenta un registro de 44 sin uso declarado, proporción que el
conjunto sintético conserva. Rechazar el valor nulo obligaría a inventar una
categoría inexistente o a descartar registros válidos de la fuente.

`referencias` y `longitudGeometria` se declaran opcionales de forma deliberada:
no intervienen en ninguna consulta ni en ninguna decisión, de modo que exigir su
presencia añadiría una restricción sin propósito.

## Validador aplicado

```javascript
db.runCommand({
  collMod: "cambios_uso_suelo",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "usoPrevio", "usoActual", "superficie", "cambio",
                 "alcaldias", "geometria"],
      properties: {
        usoPrevio: {
          bsonType: ["string", "null"],
          enum: ["Agricultura de riego", "Agricultura de temporal",
                 "Asentamientos humanos", "Cuerpos de agua",
                 "Pastizal inducido o cultivado", "Plantaciones forestales",
                 "Vegetación primaria", "Vegetación secundaria", null]
        },
        usoActual: {
          bsonType: ["string", "null"],
          enum: ["Agricultura de riego", "Agricultura de temporal",
                 "Asentamientos humanos", "Cuerpos de agua",
                 "Pastizal inducido o cultivado", "Plantaciones forestales",
                 "Vegetación primaria", "Vegetación secundaria", null]
        },
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
    }
  },
  validationLevel: "moderate",
  validationAction: "error"
})
```

Se aplicó con `collMod` porque la colección ya contenía los 50 000 documentos.

`validationAction: "error"` rechaza la escritura; `warn` se limitaría a registrar
la incidencia en el log y permitiría la inserción.

`validationLevel: "moderate"` durante las pruebas: exime a los documentos que ya
fueran inválidos y permitiría corregirlos por pasos. Comprobado que los 50 000
documentos existentes cumplen las reglas, el nivel se elevó a `strict`, que
aplica la validación a toda inserción y a toda actualización sin excepción.

### Comprobación previa

Antes de aplicar la regla se verificó que los documentos existentes no la
incumplieran:

```javascript
db.cambios_uso_suelo.countDocuments({ "cambio.tasa": { $not: { $type: "double" } } })  // 0
db.cambios_uso_suelo.countDocuments({ alcaldias: { $size: 0 } })                       // 0
```

Ningún documento requirió corrección, transformación ni exclusión.

## Casos de prueba

| Caso | `_id` | Resultado | Regla que lo explica |
|---|---|---|---|
| Documento completo con usos declarados | — | Aceptado | Cumple el esquema |
| Usos nulos | 900002 | Aceptado | `null` admitido en `usoPrevio`, `usoActual` y `cambio.descripcion` |
| Sin `geometria` | 900003 | Rechazado | `required` incluye `geometria` |
| Superficie negativa | 900004 | Rechazado | `minimum: 0` en `superficie.usoPrevioHa` |
| Categoría inexistente | 900005 | Rechazado | `enum` de `usoActual` no contiene "Zona industrial" |
| Geometría de tipo `Point` | 900006 | Rechazado | `enum` de `geometria.type` admite sólo `Polygon` y `MultiPolygon` |
| Arreglo de alcaldías vacío | 900008 | Rechazado | `minItems: 1` en `alcaldias` |

Los cinco rechazos devuelven el código 121. Cada documento inválido aísla una
sola inconsistencia: el resto de sus campos cumple el esquema, de modo que el
rechazo es atribuible a la regla indicada y no a una combinación de errores.

## Corrección del validador durante las pruebas

La primera versión del esquema rechazó un documento que debía aceptarse. El
mensaje del motor —"Document failed validation", código 121— no identifica la
regla incumplida, por lo que fue necesario localizarla.

El diagnóstico se realizó empleando `$jsonSchema` como **operador de consulta**
sobre una colección auxiliar, lo que permite evaluar el esquema por partes:

```javascript
var esquema = db.getCollectionInfos({ name: "cambios_uso_suelo" })[0]
                .options.validator.$jsonSchema;

db.pruebas_validador.insertOne(documentoDePrueba);

// Confirmar que el documento incumple el esquema completo
db.pruebas_validador.find({ $nor: [{ $jsonSchema: esquema }] }).toArray();

// Evaluar un subdocumento por separado: 1 lo cumple, 0 no
db.pruebas_validador.countDocuments({
  $jsonSchema: { bsonType: "object",
                 properties: { cambio: esquema.properties.cambio } }
});   // 0  → el fallo está en "cambio"
```

Acotado a `cambio`, se repitió el procedimiento por campo: `tasa` devolvió 1 y
`clasificacionUso` devolvió 0. La comprobación del tipo almacenado confirmó la
causa:

```javascript
db.pruebas_validador.aggregate([
  { $project: { t: { $type: "$cambio.clasificacionUso" } } }
]);   // { t: "double" }
```

El esquema exigía `["int", "long"]` para las dos clasificaciones. Los documentos
cargados con `mongoimport` almacenan esos valores como `int`, pero el shell de
MongoDB los interpreta como `double` al escribirlos manualmente, porque
JavaScript no distingue enteros de números en coma flotante.

La regla era, por tanto, demasiado estricta: rechazaba documentos correctos en
función del cliente que los escribía y no de su contenido. Se corrigió el
esquema —no los datos— admitiendo también `double` en ambos campos, conservando
`minimum: 0` y `maximum: 5`, que son las restricciones con significado para el
problema.

El mismo ajuste se aplicó preventivamente a las tres medidas de superficie y a
`cambio.tasa`.

## Interpretación y límites

El validador controla **estructura y dominio**: presencia de los campos
indispensables, tipos compatibles, categorías admitidas, cotas numéricas y
número mínimo de elementos del arreglo.

No controla **exactitud**. Una transición puede declarar una tasa dentro del
intervalo, una superficie positiva y una categoría admitida, y aun así no
corresponder con ningún cambio real de uso de suelo. La validación estructural
no sustituye la verificación contra la fuente.

Tampoco controla **coherencia entre campos**. El esquema no comprueba que
`cambio.descripcion` concuerde con el par `usoPrevio` – `usoActual`, ni que
`cambio.clasificacionUso` corresponda con la transición declarada, ni que
`superficie.areaTransicionM2` guarde relación con `superficie.usoPrevioHa`.
`$jsonSchema` evalúa cada campo por separado; las reglas que relacionan varios
campos requieren `$expr` en el validador o comprobaciones en el script de
transformación.

Sobre la geometría, el esquema verifica que `type` sea admitido y que
`coordinates` sea un arreglo. No comprueba el nivel de anidamiento, el cierre
del anillo, el orden longitud–latitud, los intervalos de las coordenadas ni la
orientación. Esas propiedades se verificaron en la generación del conjunto y se
documentan en `PROCEDENCIA_DATOS.md`.

Amazon DocumentDB puede no admitir `$jsonSchema` con el mismo alcance que
MongoDB Community. El traslado exige comprobar por separado, en la versión
objetivo, qué palabras clave del esquema se aplican y cuáles se ignoran en
silencio.
