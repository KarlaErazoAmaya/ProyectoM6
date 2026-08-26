# Expansión de los asentamientos humanos y transformación del uso de suelo en la Ciudad de México.

> Proyecto Final · Módulo 6: 
> Diplomado Manejo de bases de datos sql y nosql en un entorno de nube. — IIMAS, UNAM.    
> **Integrantes del equipo:**
>  Karla Yoloxochitl Erazo Amaya
>  Omar Octavio Sánchez Parra

---
## Descripción del proyecto

La expansión urbana constituye un proceso de transformación territorial que puede modificar la distribución de los distintos usos de suelo y tipos de vegetación. En la Ciudad de México, el crecimiento de las zonas destinadas a asentamientos humanos puede ocurrir sobre superficies que anteriormente correspondían a actividades agrícolas, vegetación, pastizales u otros usos.

Este proyecto propone utilizar **MongoDB** para almacenar, transformar, consultar y analizar información sobre los cambios de uso de suelo y vegetación en la Ciudad de México.

El análisis se enfoca particularmente en las transformaciones cuyo uso posterior corresponde a **"Asentamientos humanos"**, con el propósito de identificar los usos de suelo de origen, las superficies involucradas, las tasas de cambio asociadas y su relación espacial con las demarcaciones y con el suelo de conservación.

El alcance del proyecto es descriptivo. Los resultados permitirán identificar patrones observados en la información disponible, pero no establecer relaciones causales ni realizar pronósticos sobre el crecimiento urbano futuro.

---

## Pregunta de investigación

**¿Qué transformaciones de uso de suelo hacia asentamientos humanos se observan en la Ciudad de México durante el periodo analizado y qué relación guardan con las zonas de conservación del territorio?**

### Preguntas específicas

1. ¿Qué tipos de uso de suelo se transformaron en asentamientos humanos durante el periodo analizado?
2. ¿Qué transformaciones hacia asentamientos humanos presentan las mayores superficies y tasas de cambio?
3. ¿Qué transformaciones hacia asentamientos humanos se superponen con el suelo de conservación de la Ciudad de México?

La tercera pregunta expresa una relación espacial de **intersección**: la respuesta depende de que dos geometrías compartan una porción del territorio, y no puede obtenerse a partir de los atributos descriptivos. Se resuelve con `$geoIntersects` y requiere incorporar una segunda colección con los polígonos de referencia.

---

## Objetivo general

Analizar las transformaciones de uso de suelo hacia asentamientos humanos en la Ciudad de México mediante MongoDB, identificando los usos de suelo de origen, la superficie y tasa de cambio asociadas, así como su relación espacial con las zonas de conservación.

### Objetivos específicos

- Identificar los registros cuyo uso de suelo posterior corresponde a **asentamientos humanos**.
- Clasificar las transformaciones de acuerdo con el uso de suelo previo.
- Comparar la superficie y la tasa de cambio asociadas con las distintas transformaciones.
- Implementar consultas, agregaciones e índices en MongoDB para analizar eficientemente la información.
- Determinar mediante consultas geoespaciales qué transformaciones hacia asentamientos humanos se superponen con el suelo de conservación.

---

## Fuente de datos

El proyecto utiliza el conjunto de datos **Tasa de cambio de uso de suelo y vegetación en la Ciudad de México**, disponible en el Portal de Datos Abiertos de la Ciudad de México.

La documentación del conjunto señala que contiene información sobre la tasa de cambio de uso de suelo y vegetación de las series de INEGI, así como el uso previo y actual de las zonas, su superficie y el grupo de uso de suelo al que pertenecen.

La fuente describe cambios de uso de suelo y vegetación en la Ciudad de México durante el periodo **1992–2016**.

Los datos se encuentran en formato **GeoJSON**, lo que permite conservar tanto los atributos descriptivos como las geometrías de las zonas analizadas.

El sistema de referencia declarado en el archivo es `urn:ogc:def:crs:OGC:1.3:CRS84`, equivalente a WGS 84 con orden longitud–latitud, que es el que MongoDB espera para las geometrías GeoJSON.

---

## Conjunto de datos de trabajo

El proyecto trabaja con dos conjuntos, cada uno con un propósito distinto.

**Conjunto real.** `data/raw/`, 44 registros, de los cuales 7 son transiciones hacia asentamientos humanos con uso previo distinto. Es la fuente de cualquier afirmación sobre el fenómeno urbano.

**Conjunto sintético.** 50 000 documentos generados con `scripts/generar_sinteticos.py`. Reproduce la estructura, las categorías y los intervalos del conjunto real, pero ningún documento corresponde con un registro de la fuente. Existe porque 44 registros no permiten observar diferencias interpretables en `explain("executionStats")` ni comparar planes de ejecución antes y después de indexar. Sostiene la demostración técnica de la solución: índices, validador y consultas.

Las geometrías del conjunto sintético son polígonos de 5 a 9 vértices. Los polígonos reales alcanzan cientos de miles de vértices y un registro de la fuente supera los 16 MB del límite de BSON, por lo que no es insertable sin simplificación previa.

La separación entre ambos conjuntos es deliberada y debe conservarse al redactar conclusiones: los indicadores obtenidos sobre el conjunto sintético describen datos generados, no la Ciudad de México.

El detalle de procedencia, parámetros conservados, diferencias deliberadas y comprobaciones realizadas está en [`docs/PROCEDENCIA_DATOS.md`](docs/PROCEDENCIA_DATOS.md).

---

## Variables principales de la fuente

Entre los campos utilizados se encuentran:

| Campo original | Descripción |
|---|---|
| `OBJECTID` | Identificador del registro |
| `Grupo` | Uso de suelo o vegetación previo |
| `Grupo_1` | Uso de suelo o vegetación posterior |
| `SUM_SUPHAs` | Superficie asociada al uso previo |
| `SUM_SUPH_1` | Superficie asociada al uso posterior |
| `USVCAMB` | Descripción del cambio de uso de suelo |
| `TASACAMB` | Tasa de cambio |
| `C_USVCAMB` | Clasificación del cambio de uso |
| `C_TASACAM` | Clasificación de la tasa de cambio |
| `Shape_Leng` | Longitud asociada a la geometría |
| `Shape_Area` | Área asociada a la geometría |
| `geometry` | Geometría GeoJSON |

---

## Modelo documental

Para facilitar el análisis en MongoDB, se propone transformar la estructura original del GeoJSON a un modelo documental con nombres de campos más descriptivos.

Cada documento representa una **transición territorial entre un uso de suelo previo y un uso de suelo posterior**, junto con información sobre superficie, cambio y geometría.

Ejemplo simplificado:

```javascript
{
  _id: 3,

  usoPrevio: "Agricultura de riego",
  usoActual: "Asentamientos humanos",

  superficie: {
    usoPrevioHa: 3716.652748,
    usoActualHa: 7226.796274,
    areaTransicionM2: 1199241.831670
  },

  cambio: {
    descripcion: "Agricultura de riego -Asentamientos humanos",
    tasa: 3.2172,
    clasificacionUso: 5,
    clasificacionTasa: 2
  },

  referencias: {
    serieInicialId: 1,
    serieFinalId: 3
  },

  alcaldias: ["Xochimilco", "Tláhuac"],

  longitudGeometria: 37629.989310,

  geometria: {
    type: "MultiPolygon",
    coordinates: [...]
  }
}
```

La geometría se conserva en formato GeoJSON para permitir posteriormente la creación de índices y consultas geoespaciales.

El campo `alcaldias` no proviene de la fuente original: se incorporó al modelo porque una transición puede abarcar más de una demarcación y porque permite sustentar un índice multikey sobre un campo con significado para el problema. En el conjunto sintético se genera; al trabajar con el conjunto real deberá derivarse cruzando la geometría con los límites de las alcaldías.

---

## Correspondencia de campos

| Campo MongoDB | Campo original |
|---|---|
| `_id` | `OBJECTID` |
| `usoPrevio` | `Grupo` |
| `usoActual` | `Grupo_1` |
| `superficie.usoPrevioHa` | `SUM_SUPHAs` |
| `superficie.usoActualHa` | `SUM_SUPH_1` |
| `superficie.areaTransicionM2` | `Shape_Area` |
| `cambio.descripcion` | `USVCAMB` |
| `cambio.tasa` | `TASACAMB` |
| `cambio.clasificacionUso` | `C_USVCAMB` |
| `cambio.clasificacionTasa` | `C_TASACAM` |
| `referencias.serieInicialId` | `FID_Serie2` |
| `referencias.serieFinalId` | `FID_Serie6` |
| `longitudGeometria` | `Shape_Leng` |
| `geometria` | `geometry` |
| `alcaldias` | — (derivado; no existe en la fuente) |

---

## Diccionario de datos del modelo

| Campo | Tipo BSON | Presencia | Descripción | Restricción |
|---|---|---|---|---|
| `_id` | `int` | Obligatorio | Identificador único de la transición | Único |
| `usoPrevio` | `string/null` | Obligatorio | Uso de suelo o vegetación de origen | Categorías presentes en la fuente |
| `usoActual` | `string/null` | Obligatorio | Uso de suelo o vegetación posterior | Categorías presentes en la fuente |
| `superficie` | `object` | Obligatorio | Subdocumento que contiene las medidas de superficie | Contiene las tres medidas de superficie |
| `superficie.usoPrevioHa` | numérico | Obligatorio | Superficie asociada al uso previo | Valor no negativo |
| `superficie.usoActualHa` | numérico | Obligatorio | Superficie asociada al uso posterior | Valor no negativo |
| `superficie.areaTransicionM2` | numérico | Obligatorio | Área asociada a la geometría de la transición | Valor no negativo |
| `cambio` | `object` | Obligatorio | Subdocumento del cambio observado | Contiene la información del cambio |
| `cambio.descripcion` | `string/null` | Opcional | Descripción de la transición | Puede ser nulo según la fuente |
| `cambio.tasa` | numérico | Obligatorio | Tasa de cambio | Puede ser positiva o negativa |
| `cambio.clasificacionUso` | numérico | Obligatorio | Clasificación del cambio de uso | Valores observados de 0 a 5 |
| `cambio.clasificacionTasa` | numérico | Obligatorio | Clasificación de la tasa | Valores observados de 0 a 5 |
| `alcaldias` | `array` de `string` | Obligatorio | Alcaldías en las que ocurre la transición | Al menos una demarcación |
| `referencias` | `object` | Opcional | Identificadores de las series comparadas | Opcional |
| `referencias.serieInicialId` | `int` | Opcional | Identificador de la serie inicial | Entero |
| `referencias.serieFinalId` | `int` | Opcional | Identificador de la serie final | Entero |
| `longitudGeometria` | numérico | Opcional | Longitud asociada a la geometría | Valor no negativo |
| `geometria` | `object` | Obligatorio | Geometría GeoJSON | Obligatoria |
| `geometria.type` | `string` | Obligatorio | Tipo de geometría | `Polygon` o `MultiPolygon` |
| `geometria.coordinates` | `array` | Obligatorio | Coordenadas de la geometría | Estructura GeoJSON |

Los campos marcados como *numérico* admiten `double`, `int` y `long`. La distinción importa: los documentos cargados con `mongoimport` almacenan los enteros como `int`, mientras que el shell de MongoDB los interpreta como `double` al escribirlos manualmente. Exigir un único tipo rechazaría documentos correctos en función del cliente que los escribe y no de su contenido. El detalle está en [`docs/validacion.md`](docs/validacion.md).

---

## Categorías de uso de suelo y vegetación

En los datos se identificaron las siguientes categorías:

- Agricultura de riego
- Agricultura de temporal
- Asentamientos humanos
- Cuerpos de agua
- Pastizal inducido o cultivado
- Plantaciones forestales
- Vegetación primaria
- Vegetación secundaria

Los valores nulos presentes en la fuente se conservarán como `null` para evitar sustituir información faltante por categorías no proporcionadas por la fuente.

---

## Estrategia de almacenamiento

Se propone trabajar con dos colecciones:

### `cambios_uso_suelo_raw`

Conservará los registros provenientes de la fuente con su estructura original.

### `cambios_uso_suelo`

Contendrá los documentos transformados al modelo definido para el proyecto.

El flujo general será:

```text
GeoJSON original
       ↓
cambios_uso_suelo_raw
       ↓
transformación
       ↓
cambios_uso_suelo
       ↓
consultas + agregaciones + índices + validación + análisis geoespacial
```

Esta separación permite conservar los datos originales y hacer reproducible el proceso de transformación.

Para la demostración técnica, el conjunto sintético se genera ya con el modelo documental de destino y se carga directamente en `cambios_uso_suelo`, sin pasar por la colección `raw`:

```text
generar_sinteticos.py
       ↓
cambios_uso_suelo_sintetico.json
       ↓
cambios_uso_suelo
```

Ambas rutas terminan en la misma colección y en el mismo modelo, por lo que las consultas, los índices y el validador son idénticos para las dos.

---

## Consultas de interés

El análisis estará orientado principalmente a identificar las transformaciones cuyo uso posterior corresponde a asentamientos humanos.

Los patrones de consulta seleccionados para el análisis de rendimiento son tres:

```javascript
// A. Transiciones más intensas hacia asentamientos humanos
db.cambios_uso_suelo.find({ usoActual: "Asentamientos humanos" })
                    .sort({ "cambio.tasa": -1 })
```

```javascript
// B. Urbanización sobre un uso previo específico, por encima de un umbral
db.cambios_uso_suelo.find({
  usoActual: "Asentamientos humanos",
  usoPrevio: "Agricultura de temporal",
  "cambio.tasa": { $gte: 5 }
})
```

```javascript
// C. Transiciones que afectan a una alcaldía determinada
db.cambios_uso_suelo.find({
  usoActual: "Asentamientos humanos",
  alcaldias: "Xochimilco"
})
```

Entre las tres cubren los casos que interesa medir: igualdad con ordenamiento, igualdades con rango, y consulta sobre un campo de arreglo. También se utilizarán pipelines de agregación para clasificar las transformaciones por uso previo, calcular superficies asociadas y comparar las tasas de cambio.

---

## Indexación y rendimiento

Los índices se diseñaron a partir de los patrones reales de consulta del proyecto y su utilidad se comprobó con `explain("executionStats")` antes y después de crearlos, conservando sin cambios la forma de las consultas.

| Índice | Consulta que apoya | Multikey |
|---|---|---|
| `uso_tasa` `{ usoActual, usoPrevio, cambio.tasa }` | B | No |
| `uso_tasa_orden` `{ usoActual, cambio.tasa }` | A | No |
| `uso_alcaldias` `{ usoActual, alcaldias }` | C | Sí |

Resultado de la comparación:

| Consulta | Plan antes | Plan después | Documentos examinados | Devueltos |
|---|---|---|---:|---:|
| A | SORT ← COLLSCAN | FETCH ← IXSCAN | 50 000 → 14 347 | 14 347 |
| B | COLLSCAN | FETCH ← IXSCAN | 50 000 → 1 880 | 1 880 |
| C | COLLSCAN | FETCH ← IXSCAN | 50 000 → 1 196 | 1 196 |

El número de resultados no cambió en ninguna de las tres consultas. La justificación del orden de los campos, el análisis del índice multikey, el costo en almacenamiento y escritura y los límites de la evidencia están en [`docs/indexacion.md`](docs/indexacion.md); la medición inicial, en [`docs/medicion_inicial.md`](docs/medicion_inicial.md).

---

## Validación

La colección transformada utiliza un validador mediante `$jsonSchema`.

La validación comprueba aspectos como:

- presencia de campos requeridos;
- tipos BSON;
- categorías válidas de uso de suelo;
- valores permitidos para las clasificaciones;
- estructura de los subdocumentos;
- número mínimo de elementos del arreglo de alcaldías;
- tipos de geometría admitidos.

Los campos que presentan valores nulos en la fuente original permiten explícitamente `null`, evitando modificar artificialmente la información de origen.

Se realizaron pruebas con dos documentos válidos y cinco inválidos. Cada documento inválido aísla una sola inconsistencia, de modo que el rechazo es atribuible a una regla concreta:

| Caso | Resultado | Regla |
|---|---|---|
| Documento completo | Aceptado | Cumple el esquema |
| Usos nulos | Aceptado | `null` admitido en `usoPrevio` y `usoActual` |
| Sin `geometria` | Rechazado | `required` |
| Superficie negativa | Rechazado | `minimum: 0` |
| Categoría inexistente | Rechazado | `enum` de `usoActual` |
| Geometría de tipo `Point` | Rechazado | `enum` de `geometria.type` |
| Arreglo de alcaldías vacío | Rechazado | `minItems: 1` |

El detalle, incluida la corrección que fue necesario aplicar al esquema durante las pruebas, está en [`docs/validacion.md`](docs/validacion.md).

---

## Análisis geoespacial

La geometría de cada transición se conserva en formato GeoJSON.

Esto permite crear un índice:

```javascript
{ geometria: "2dsphere" }
```

y realizar consultas geoespaciales para responder la tercera pregunta específica: qué transformaciones hacia asentamientos humanos se superponen con el suelo de conservación.

La relación pertinente es de **intersección**, no de contención: entre polígonos de fuentes distintas la contención completa es infrecuente, mientras que el traslape parcial es exactamente lo que interesa detectar. El operador correspondiente es `$geoIntersects`.

El componente se resolvió con `$geoIntersects` contra la colección
`zonas_conservacion`, tres polígonos sintéticos que aproximan la distribución
del suelo de conservación. La selección espacial devuelve 21 683 transiciones
frente a las 13 123 que devolvería `$geoWithin`: esos 8 560 documentos de
diferencia son los que cruzan un borde sin quedar contenidos, y son la
evidencia de que ambos operadores no son equivalentes.

Al añadir el filtro temático —uso posterior asentamientos humanos, excluyendo
los registros cuyo uso previo ya era urbano— la selección queda en 5 524
transiciones, agrupadas en siete usos previos.

El detalle en [`docs/casos_control_geoespacial.md`](docs/casos_control_geoespacial.md)
y [`docs/pipeline_geoespacial.md`](docs/pipeline_geoespacial.md).

---

## Alcance

Los resultados del proyecto permitirán:

- identificar los usos de suelo que presentan transformaciones hacia asentamientos humanos;
- cuantificar y comparar las superficies asociadas;
- analizar las tasas de cambio registradas;
- identificar patrones territoriales;
- determinar qué transformaciones se superponen con el suelo de conservación.

Los resultados **no permiten por sí solos establecer las causas de la expansión urbana ni pronosticar su comportamiento futuro**.

Una superposición espacial entre una transformación y una zona de conservación indica coincidencia territorial, no infracción, responsabilidad ni causa. El resultado depende además de los límites tal como están registrados: otra escala, otra fuente o otra fecha producirían un subconjunto distinto.

El conjunto de datos tampoco contiene información sobre siniestros, pérdidas económicas o exposición asegurada. Por ello, cualquier aplicación en análisis de riesgos o seguros requeriría integrar fuentes adicionales.

---

## Tecnologías

- MongoDB
- MongoDB Shell (`mongosh`)
- GeoJSON
- Python (generación del conjunto sintético)
- Amazon S3 (almacenamiento del conjunto de datos)
- JavaScript
- Git
- GitHub

---

## Ejecución

El entorno de MongoDB proviene del repositorio del curso y debe iniciarse antes que cualquier otro paso.

```bash
# 1. Entorno de MongoDB (sólo la primera vez en cada contenedor)
cd ~
git clone https://github.com/manu-msr/M6-NOSQL.git m6-nosql
cd ~/m6-nosql
bash setup/setup.sh
bash setup/conectar.sh        # esperar "MongoDB está activo"; salir con exit

# 2. Repositorio del proyecto
cd ~
git clone https://github.com/KarlaErazoAmaya/ProyectoM6.git
cd ~/ProyectoM6

# 3. Datos
aws s3 cp s3://datos-proyecto-diplo-omar-y-karla/cambios_uso_suelo_sintetico.json .
# alternativa si el bucket ya no existe:
# python3 scripts/generar_sinteticos.py

# 4. Carga y evidencias
bash scripts/01_carga_datos.sh
MONGOSH=~/m6-nosql/.tools/bin/mongosh
URI="mongodb://127.0.0.1:27017/m6_nosql"
$MONGOSH "$URI" --quiet scripts/02_consultas_base.js | tee evidencias/medicion_inicial.txt
$MONGOSH "$URI" --quiet scripts/03_indices.js      | tee evidencias/medicion_posterior.txt
$MONGOSH "$URI" --quiet scripts/04_validador.js    | tee evidencias/validador.txt
$MONGOSH "$URI" --quiet scripts/05_geoespacial.js | tee evidencias/geoespacial.txt
```

El orden importa: `02` mide sin índices secundarios y los elimina para garantizar el estado de partida; `03` los crea y repite exactamente las mismas consultas; `04` aplica el validador y ejecuta los casos de prueba. Cada script parte de un estado conocido, comprueba sus propios resultados y puede repetirse.

Si `mongoimport` se detiene en `0B (0.0%)`, el servidor de MongoDB no está en ejecución: interrumpir con `Ctrl+C` y volver al paso 1.

---

## Resultados

Los resultados deben interpretarse distinguiendo el conjunto real del conjunto sintético. Las cifras obtenidas durante las consultas de rendimiento y el análisis geoespacial corresponden a los 50 000 documentos sintéticos y demuestran el funcionamiento de la solución; no representan 50 000 transformaciones reales ocurridas en la Ciudad de México.

### Respuesta a la pregunta principal

El análisis permitió identificar transformaciones hacia asentamientos humanos provenientes de distintos usos de suelo y detectar cuáles presentan superposición espacial con las zonas de conservación utilizadas como referencia.

Entre las transformaciones que intersectaron estas zonas, los usos previos con mayor presencia fueron **Agricultura de temporal**, **Agricultura de riego** y **Pastizal inducido o cultivado**.

Por lo tanto, el modelo permite combinar atributos descriptivos y geometrías para estudiar tanto el tipo de transformación como su distribución espacial.

### Resultados de las preguntas específicas

#### 1. Transformaciones hacia asentamientos humanos

La consulta sobre `usoActual: "Asentamientos humanos"` devolvió **14 347 documentos sintéticos**. Estos registros pueden ordenarse por `cambio.tasa` para identificar las transformaciones de mayor intensidad.

#### 2. Agricultura de temporal y tasa de cambio

Al restringir la consulta a:

- uso previo: `Agricultura de temporal`;
- uso actual: `Asentamientos humanos`;
- tasa de cambio mayor o igual a 5;

se obtuvieron **1 880 documentos sintéticos**.

Esta consulta también permitió evaluar el efecto de la indexación: el número de documentos examinados disminuyó de **50 000 a 1 880**, manteniendo el mismo número de resultados.

#### 3. Superposición espacial

La consulta con `$geoIntersects` identificó **21 683 documentos** que intersectan alguna de las tres zonas de conservación sintéticas utilizadas como referencia.

Al incorporar el filtro hacia asentamientos humanos se obtuvieron **6 286 registros**. Después de excluir aquellos cuyo uso previo ya era `Asentamientos humanos`, quedaron **5 524 transformaciones efectivas**.

Estas se distribuyeron según su uso previo de la siguiente manera:

| Uso previo | Transiciones |
|---|---:|
| Agricultura de temporal | 1 372 |
| Agricultura de riego | 1 087 |
| Pastizal inducido o cultivado | 900 |
| Vegetación secundaria | 785 |
| Vegetación primaria | 751 |
| Plantaciones forestales | 399 |
| Cuerpos de agua | 230 |

Estos resultados muestran la capacidad del componente geoespacial para identificar y clasificar las transformaciones que presentan una relación de intersección con las zonas utilizadas como referencia.

### Resultados técnicos

Además del análisis temático, se obtuvieron los siguientes resultados técnicos:

- Las tres consultas evaluadas pasaron de planes basados en `COLLSCAN` a planes que utilizan `IXSCAN`.
- La consulta A redujo los documentos examinados de 50 000 a 14 347.
- La consulta B redujo los documentos examinados de 50 000 a 1 880.
- La consulta C redujo los documentos examinados de 50 000 a 1 196.
- El validador `$jsonSchema` aceptó los casos válidos y rechazó los cinco casos inválidos definidos.
- El índice `2dsphere` permitió implementar las consultas geoespaciales.
- Se implementó una salida minimizada que excluye la geometría completa cuando no es necesaria para el análisis.

---

## Evaluación del componente temporal

Se evaluó la pertinencia de incorporar un análisis temporal al proyecto.

Aunque la fuente original describe transformaciones ocurridas dentro del periodo 1992–2016, los documentos no contienen una fecha individual de ocurrencia asociada a cada transición.

Por esta razón, no resulta metodológicamente adecuado asignar fechas artificiales, realizar agrupaciones por año o construir una serie temporal que la fuente no permite observar.

Se decidió no implementar un análisis temporal específico y fortalecer en su lugar el componente geoespacial, ya que las geometrías GeoJSON sí forman parte de los datos disponibles y permiten responder directamente a la pregunta de investigación.

Esta decisión constituye también una limitación del análisis: los resultados permiten estudiar las transformaciones registradas y su distribución espacial, pero no reconstruir su evolución año con año.

---

## Seguridad y protección de datos

Los datos utilizados son públicos y no contienen información personal. Por ello, las medidas de protección se enfocaron principalmente en **minimización de información** y **principio de mínimo privilegio**.

### Minimización

Se implementó una consulta que devuelve únicamente los campos necesarios para el análisis:

- `usoPrevio`;
- `usoActual`;
- `superficie`;
- `cambio.tasa`;
- `alcaldias`.

La geometría completa se excluye de esta salida cuando no es necesaria, reduciendo la cantidad de información transferida.

La prueba mostró cinco documentos y confirmó que la geometría completa no estaba incluida en la salida.

### Mínimo privilegio

Se plantearon roles diferenciados según las necesidades de cada usuario o proceso. Un usuario dedicado a consultas debería disponer únicamente de permisos de lectura sobre las colecciones necesarias, mientras que los procesos de carga deberían recibir solamente los permisos indispensables para realizar sus operaciones.

En el entorno utilizado no se habilitó autenticación, por lo que el mínimo privilegio se documenta como una propuesta de diseño y no como una denegación de acceso comprobada.

Las credenciales y cadenas de conexión no deben almacenarse directamente en el código del proyecto.

---

## Conclusiones

El proyecto permitió integrar los principales componentes estudiados en el módulo mediante una solución reproducible en MongoDB para el análisis de cambios de uso de suelo.

El modelo documental permitió almacenar conjuntamente los atributos descriptivos de cada transición y su geometría GeoJSON. A partir de los patrones de consulta se diseñaron índices específicos cuya utilidad se comprobó mediante `explain("executionStats")`, reduciendo considerablemente el número de documentos examinados sin modificar los resultados obtenidos.

La validación mediante `$jsonSchema` permitió establecer reglas de calidad para los documentos, mientras que el componente geoespacial permitió identificar superposiciones entre las transformaciones hacia asentamientos humanos y las zonas utilizadas como referencia.

El análisis temporal no se implementó debido a la ausencia de una fecha individual para cada transición. En lugar de introducir fechas artificiales, se fortaleció el análisis geoespacial.

Finalmente, se incorporaron principios básicos de seguridad mediante minimización de información y una propuesta de mínimo privilegio.

La principal limitación es que las pruebas de rendimiento y los resultados cuantitativos del análisis geoespacial se realizaron sobre datos sintéticos. Por ello, estos resultados demuestran el funcionamiento de la solución, pero no deben interpretarse como una medición de la magnitud real de la expansión urbana de la Ciudad de México.

Como trabajo futuro se propone incorporar polígonos oficiales de suelo de conservación, derivar las alcaldías del conjunto real mediante intersección con límites administrativos y, si se dispone de información con fechas individuales, ampliar el proyecto hacia un análisis temporal.


## Estructura del repositorio

```text
ProyectoM6/
│
├── README.md
│
├── data/
│   ├── raw/
│   │   └── tasa_cambio_uso_suelo.geojson
│   └── processed/
│
├── scripts/
│   ├── generar_sinteticos.py
│   ├── 01_carga_datos.sh
│   ├── 02_consultas_base.js
│   ├── 03_indices.js
│   ├── 04_validador.js
│   ├── 05_geoespacial.js
│   └── 06_seguridad.js
│
├── docs/
│   ├── PROCEDENCIA_DATOS.md
│   ├── medicion_inicial.md
│   ├── indexacion.md
│   ├── validacion.md
│   ├── casos_control_geoespacial.md
│   ├── pipeline_geoespacial.md
│   └── semana04_temporal.md
│
├── zonas_conservacion.json
├── casos_control_geo.json
│
└── evidencias/
    ├── medicion_inicial.txt
    ├── medicion_posterior.txt
    ├── validador.txt
    ├── geoespacial.txt
    └── mapa_asentamientos_humanos...
```

El conjunto sintético no se versiona: pesa 35 MB, es un archivo generado y `generar_sinteticos.py` lo reproduce de forma idéntica gracias a su semilla fija. Se conserva en Amazon S3.

---

## Estado del proyecto

- [x] Definición del problema
- [x] Pregunta de investigación
- [x] Objetivos
- [x] Selección de la fuente de datos
- [x] Exploración inicial del GeoJSON
- [x] Diseño del modelo documental
- [x] Diccionario de datos
- [x] Creación del repositorio y estructura
- [x] Generación del conjunto de datos de trabajo
- [x] Carga de datos
- [x] Consultas base
- [x] Diseño de índices
- [x] Evaluación con `explain("executionStats")`
- [x] Implementación de `$jsonSchema`
- [x] Pruebas de validación
- [x] Colección de polígonos de referencia
- [x] Índice geoespacial `2dsphere`
- [x] Consultas geoespaciales
- [x] Seguridad y protección de datos
- [x] Interpretación de resultados
- [x] Conclusiones

## Mejoras futuras

- Incorporar polígonos oficiales de suelo de conservación y documentar su procedencia, sistema de referencia y fecha de consulta.
- Derivar el campo `alcaldias` para el conjunto real mediante intersección con los límites oficiales de las demarcaciones.
- Incorporar información con fechas individuales de transición para permitir un análisis temporal.
- Verificar de manera independiente la compatibilidad de `$jsonSchema`, índices `2dsphere`, `$geoIntersects` y `$geoNear` en la versión objetivo de Amazon DocumentDB.
