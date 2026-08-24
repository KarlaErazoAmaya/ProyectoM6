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

Este componente requiere incorporar una segunda colección con los polígonos de referencia, cuya procedencia, sistema de referencia y fecha de consulta deberán registrarse igual que los del conjunto principal.

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
```

El orden importa: `02` mide sin índices secundarios y los elimina para garantizar el estado de partida; `03` los crea y repite exactamente las mismas consultas; `04` aplica el validador y ejecuta los casos de prueba. Cada script parte de un estado conocido, comprueba sus propios resultados y puede repetirse.

Si `mongoimport` se detiene en `0B (0.0%)`, el servidor de MongoDB no está en ejecución: interrumpir con `Ctrl+C` y volver al paso 1.

---

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
│   └── 05_geoespacial.js
│
├── docs/
│   ├── PROCEDENCIA_DATOS.md
│   ├── medicion_inicial.md
│   ├── indexacion.md
│   └── validacion.md
│
└── evidencias/
    ├── medicion_inicial.txt
    ├── medicion_posterior.txt
    └── validador.txt
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
- [ ] Colección de polígonos de referencia
- [ ] Índice geoespacial `2dsphere`
- [ ] Consultas geoespaciales
- [ ] Seguridad y protección de datos
- [ ] Interpretación de resultados
- [ ] Conclusiones

### Decisiones pendientes

- Incorporar la colección de polígonos de suelo de conservación que requiere la tercera pregunta, y registrar su procedencia, sistema de referencia y fecha de consulta.
- Derivar el campo `alcaldias` para el conjunto real cruzando la geometría con los límites de las demarcaciones.
- Verificar en Amazon DocumentDB, por separado y en la versión objetivo: el alcance de `$jsonSchema`, el soporte de índices `2dsphere` sobre geometrías `Polygon`, el comportamiento de `$geoIntersects` y la disponibilidad de `$geoNear` como primera etapa de un pipeline. Un plan de ejecución o una regla admitida en MongoDB Community no debe atribuirse a DocumentDB sin comprobación propia.
