# Casos de control del componente geoespacial

Guía de avance, semana 3, §3.8.

Colección `cambios_uso_suelo` · 50 000 documentos más 4 casos de control ·
MongoDB Community 4.4.29

## Estado de partida

| Elemento | Valor |
|---|---|
| Documentos con geometría utilizable | 50 000 de 50 000 |
| Zonas de conservación cargadas | 3 |
| Índice geoespacial | `geometria_2dsphere`, `2dsphereIndexVersion: 3` |
| Índices convencionales conservados | `uso_tasa`, `uso_tasa_orden`, `uso_alcaldias` |

El índice geoespacial se creó sobre `cambios_uso_suelo`, que es la colección que
se filtra. Las tres zonas de conservación **no** se indexaron: en una consulta
`$geoIntersects` el índice que trabaja es el de la colección filtrada, no el de
la geometría de referencia, y tres documentos caben en memoria sin costo. Cada
índice debe derivarse de una pregunta; ninguna consulta del proyecto recorre las
zonas.

## Geometría de referencia

```javascript
var zona = db.zonas_conservacion.findOne({ _id: "ZC-01" }).geometria
```

`ZC-01`, "Sierra del Ajusco". `Polygon` de 31 vértices, anillo cerrado y
orientado en sentido antihorario.

## Casos preparados

| `_id` | Ubicación respecto de ZC-01 | `usoActual` |
|---|---|---|
| 990001 | Contenida por completo | Asentamientos humanos |
| 990002 | Cruza el borde norte | Asentamientos humanos |
| 990003 | Al norte, lejos de toda zona | Asentamientos humanos |
| 990004 | Contenida por completo | Vegetación secundaria |

## Resultados

### Selección espacial con `$geoIntersects`

```javascript
db.cambios_uso_suelo.find(
  { _id: { $gte: 990000 },
    geometria: { $geoIntersects: { $geometry: zona } } },
  { _id: 1, usoActual: 1 }
).toArray()
```

| Incluidos | Excluidos |
|---|---|
| 990001, 990002, 990004 | 990003 |

`990003` queda fuera por la comparación geométrica: su polígono no comparte
ninguna porción de espacio con la zona.

### Selección espacial con `$geoWithin`

```javascript
db.cambios_uso_suelo.find(
  { _id: { $gte: 990000 },
    geometria: { $geoWithin: { $geometry: zona } } },
  { _id: 1 }
).toArray()
```

| Incluidos | Excluidos |
|---|---|
| 990001, 990004 | 990002, 990003 |

**`990002` desaparece.** Es el resultado que sustenta la elección del operador:
cruza el borde de la zona sin quedar contenida en ella, de modo que
`$geoIntersects` lo recupera y `$geoWithin` no. Si ambos operadores hubieran
devuelto lo mismo, no habría evidencia de que representan relaciones distintas.

### Selección espacial más filtro temático

```javascript
db.cambios_uso_suelo.find(
  { _id: { $gte: 990000 },
    usoActual: "Asentamientos humanos",
    geometria: { $geoIntersects: { $geometry: zona } } },
  { _id: 1 }
).toArray()
```

| Incluidos | Excluidos |
|---|---|
| 990001, 990002 | 990003, 990004 |

`990004` cae al añadir el filtro. Está contenido en la zona, pero su uso
posterior es vegetación secundaria: satisface la condición espacial y no la
temática. Es el caso que la guía pide comprobar por separado, y confirma que la
selección espacial y el filtro por atributo operan de forma independiente.

## Resumen

| Caso | `$geoIntersects` | `$geoWithin` | Con filtro temático |
|---|:-:|:-:|:-:|
| 990001 contenida, asentamientos humanos | sí | sí | sí |
| 990002 cruza el borde, asentamientos humanos | sí | no | sí |
| 990003 fuera, asentamientos humanos | no | no | no |
| 990004 contenida, vegetación secundaria | sí | sí | no |

Los cuatro casos se comportaron como se esperaba.

## Selección sobre el conjunto completo

| Selección | Documentos | Porcentaje |
|---|---:|---:|
| Intersectan alguna de las tres zonas | 21 683 | 43.4 % |
| Contenidas por completo en alguna zona | 13 123 | 26.2 % |

La diferencia de 8 560 documentos corresponde a transiciones que cruzan el borde
de una zona sin quedar contenidas en ella.

La consulta sobre las tres zonas usa `$or` para evitar que un documento que
tocara dos zonas se contara dos veces. Las zonas se construyeron sin traslape,
de modo que ese caso no se presenta, pero la consulta es correcta con
independencia de ello.

## Limitaciones

**Los datos son sintéticos.** Las transiciones y las zonas se generaron para
demostrar el funcionamiento de la solución. Los conteos describen los polígonos
generados y no el territorio de la Ciudad de México.

**Una superposición no es una infracción.** Que una transición comparta espacio
con una zona de conservación indica coincidencia territorial, no incumplimiento
normativo, responsabilidad ni causa.

**Un conteo no es una tasa.** 21 683 transiciones que intersectan una zona no
expresan una proporción del territorio afectado mientras no exista un
denominador: superficie total de la zona, o superficie total transformada.

**El resultado depende de los límites empleados.** Otra escala, otra fuente o
otra fecha de los polígonos de referencia producirían un subconjunto distinto.
Los polígonos oficiales tienen bordes mucho más detallados, y esa diferencia
afecta directamente qué transiciones se consideran superpuestas.

**No se probaron casos sobre el borde exacto.** Los cuatro casos de control
están claramente dentro, claramente fuera o claramente cruzando. El
comportamiento del motor con un polígono cuyo vértice coincida exactamente con
el límite de la zona no se comprobó y no debe suponerse.

## Reproducción

```bash
bash ~/m6-nosql/setup/conectar.sh        # iniciar MongoDB; salir con exit
cd ~/ProyectoM6

# Cargar las zonas
~/m6-nosql/.tools/bin/mongosh "mongodb://127.0.0.1:27017/m6_nosql" --quiet --eval '
var lineas = cat("data/zonas_conservacion.json").split("\n");
db.zonas_conservacion.drop();
var docs = [];
for (var i = 0; i < lineas.length; i++) { if (lineas[i]) docs.push(JSON.parse(lineas[i])); }
db.zonas_conservacion.insertMany(docs);
'

# Cargar los casos de control
~/m6-nosql/.tools/bin/mongosh "mongodb://127.0.0.1:27017/m6_nosql" --quiet --eval '
var casos = JSON.parse(cat("data/casos_control_geo.json"));
db.cambios_uso_suelo.deleteMany({ _id: { $gte: 990000 } });
casos.forEach(function (c) { delete c._nota; db.cambios_uso_suelo.insertOne(c); });
'
```

## Nota sobre el entorno

El entorno del Learner Lab **no incluye `mongoimport`**: `.tools/bin` contiene
únicamente `mongod` y el shell, y ese shell es el cliente legacy de MongoDB 4.4,
que no dispone de `require()`. La carga se realiza con `cat()` dentro del shell.

`cat()` rechaza archivos grandes con el mensaje *file too big to load as a
variable*, por lo que el conjunto de 50 000 documentos debe partirse antes de
cargarlo:

```bash
mkdir -p /tmp/trozos && split -l 5000 cambios_uso_suelo_sintetico.json /tmp/trozos/parte_
```

Las zonas y los casos de control, por su tamaño, se cargan en una sola
operación.

## Pendientes

- `scripts/01_carga_datos.sh` usa `mongoimport` y, en su alternativa,
  `require('fs')`. Ninguno de los dos existe en este entorno: debe reescribirse
  con `cat()` y partición del archivo.
- `scripts/03_indices.js` elimina todos los índices secundarios antes de crear
  los suyos, de modo que borraría `geometria_2dsphere`. El orden de ejecución
  debe ser 02 → 03 → creación del índice geoespacial, o bien `03_indices.js`
  debe preservar el índice geoespacial.
- Falta el pipeline de agregación que lleve la selección comprobada a
  indicadores por zona o por uso previo (§3.7).
