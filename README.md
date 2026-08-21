# Expansión de los asentamientos humanos y transformación del uso de suelo en la Ciudad de México.

> Proyecto Final · Módulo 5: 
> Diplomado Manejo de bases de datos sql y nosql en un entorno de nube. — IIMAS, UNAM.    
> **Integrantes del equipo:**
>  Karla Yoloxochitl Erazo Amaya
>  Omar Octavio Sánchez Parra

---
## Descripción del proyecto

La expansión urbana constituye un proceso de transformación territorial que puede modificar la distribución de los distintos usos de suelo y tipos de vegetación. En la Ciudad de México, el crecimiento de las zonas destinadas a asentamientos humanos puede ocurrir sobre superficies que anteriormente correspondían a actividades agrícolas, vegetación, pastizales u otros usos.

Este proyecto propone utilizar **MongoDB** para almacenar, transformar, consultar y analizar información sobre los cambios de uso de suelo y vegetación en la Ciudad de México.

El análisis se enfoca particularmente en las transformaciones cuyo uso posterior corresponde a **"Asentamientos humanos"**, con el propósito de identificar los usos de suelo de origen, las superficies involucradas, las tasas de cambio asociadas y su distribución espacial.

El alcance del proyecto es descriptivo. Los resultados permitirán identificar patrones observados en la información disponible, pero no establecer relaciones causales ni realizar pronósticos sobre el crecimiento urbano futuro.

---

## Pregunta de investigación

**¿Qué transformaciones de uso de suelo hacia asentamientos humanos se observan en la Ciudad de México durante el periodo analizado y cómo se distribuyen espacialmente?**

### Preguntas específicas

1. ¿Qué tipos de uso de suelo se transformaron en asentamientos humanos durante el periodo analizado?
2. ¿Qué transformaciones hacia asentamientos humanos presentan las mayores superficies y tasas de cambio?
3. ¿Cómo se distribuyen espacialmente las áreas que cambiaron hacia asentamientos humanos en la Ciudad de México?

---

## Objetivo general

Analizar las transformaciones de uso de suelo hacia asentamientos humanos en la Ciudad de México mediante MongoDB, identificando los usos de suelo de origen, la superficie y tasa de cambio asociadas, así como su distribución espacial.

### Objetivos específicos

- Identificar los registros cuyo uso de suelo posterior corresponde a **asentamientos humanos**.
- Clasificar las transformaciones de acuerdo con el uso de suelo previo.
- Comparar la superficie y la tasa de cambio asociadas con las distintas transformaciones.
- Implementar consultas, agregaciones e índices en MongoDB para analizar eficientemente la información.
- Analizar mediante consultas geoespaciales la distribución de las superficies transformadas hacia asentamientos humanos.

---

## Fuente de datos

El proyecto utiliza el conjunto de datos **Tasa de cambio de uso de suelo y vegetación en la Ciudad de México**, disponible en el Portal de Datos Abiertos de la Ciudad de México.

La documentación del conjunto señala que contiene información sobre la tasa de cambio de uso de suelo y vegetación de las series de INEGI, así como el uso previo y actual de las zonas, su superficie y el grupo de uso de suelo al que pertenecen.

La fuente describe cambios de uso de suelo y vegetación en la Ciudad de México durante el periodo **1992–2016**.

Los datos se encuentran en formato **GeoJSON**, lo que permite conservar tanto los atributos descriptivos como las geometrías de las zonas analizadas.

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

  longitudGeometria: 37629.989310,

  geometria: {
    type: "MultiPolygon",
    coordinates: [...]
  }
}
```

La geometría se conserva en formato GeoJSON para permitir posteriormente la creación de índices y consultas geoespaciales.

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

---

## Diccionario de datos del modelo

| Campo | Tipo BSON | Descripción | Restricción |
|---|---|---|---|
| `_id` | `int` | Identificador único de la transición | Único |
| `usoPrevio` | `string/null` | Uso de suelo o vegetación de origen | Categorías presentes en la fuente |
| `usoActual` | `string/null` | Uso de suelo o vegetación posterior | Categorías presentes en la fuente |
| `superficie.usoPrevioHa` | `double` | Superficie asociada al uso previo | Valor no negativo |
| `superficie.usoActualHa` | `double` | Superficie asociada al uso posterior | Valor no negativo |
| `superficie.areaTransicionM2` | `double` | Área asociada a la geometría de la transición | Valor no negativo |
| `cambio.descripcion` | `string/null` | Descripción de la transición | Puede ser nulo según la fuente |
| `cambio.tasa` | `double` | Tasa de cambio | Puede ser positiva o negativa |
| `cambio.clasificacionUso` | `int` | Clasificación del cambio de uso | Valores observados de 0 a 5 |
| `cambio.clasificacionTasa` | `int` | Clasificación de la tasa | Valores observados de 0 a 5 |
| `referencias.serieInicialId` | `int` | Identificador de la serie inicial | Entero |
| `referencias.serieFinalId` | `int` | Identificador de la serie final | Entero |
| `longitudGeometria` | `double` | Longitud asociada a la geometría | Valor no negativo |
| `geometria` | `object` | Geometría GeoJSON | Obligatoria |
| `geometria.type` | `string` | Tipo de geometría | `Polygon` o `MultiPolygon` |
| `geometria.coordinates` | `array` | Coordenadas de la geometría | Estructura GeoJSON |

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

---

## Consultas de interés

El análisis estará orientado principalmente a identificar las transformaciones cuyo uso posterior corresponde a asentamientos humanos.

Entre los patrones de consulta considerados se encuentran:

```javascript
// Registros cuyo uso posterior es asentamientos humanos
{
  usoActual: "Asentamientos humanos"
}
```

```javascript
// Transformaciones hacia asentamientos humanos,
// excluyendo superficies que ya eran asentamientos humanos
{
  usoActual: "Asentamientos humanos",
  usoPrevio: { $ne: "Asentamientos humanos" }
}
```

También se utilizarán pipelines de agregación para clasificar las transformaciones por uso previo, calcular superficies asociadas y comparar las tasas de cambio.

---

## Indexación y rendimiento

Se diseñarán índices a partir de los patrones reales de consulta utilizados en el proyecto.

Su utilidad se evaluará mediante:

```javascript
explain("executionStats")
```

Se compararán, entre otros indicadores:

- estrategia de ejecución;
- documentos examinados;
- claves examinadas;
- documentos devueltos.

El objetivo será comprobar si los índices propuestos reducen el trabajo necesario para resolver las consultas seleccionadas.

---

## Validación

La colección transformada utilizará un validador mediante `$jsonSchema`.

La validación comprobará aspectos como:

- presencia de campos requeridos;
- tipos BSON;
- categorías válidas de uso de suelo;
- valores permitidos para las clasificaciones;
- estructura de los subdocumentos;
- tipos de geometría admitidos.

Los campos que presentan valores nulos en la fuente original permitirán explícitamente `null`, evitando modificar artificialmente la información de origen.

Se realizarán pruebas con documentos válidos e inválidos para comprobar el funcionamiento del esquema.

---

## Análisis geoespacial

La geometría de cada transición se conservará en formato GeoJSON.

Esto permitirá crear un índice:

```javascript
{ geometria: "2dsphere" }
```

y posteriormente realizar consultas geoespaciales para estudiar la distribución territorial de las transformaciones hacia asentamientos humanos.

---

## Alcance

Los resultados del proyecto permitirán:

- identificar los usos de suelo que presentan transformaciones hacia asentamientos humanos;
- cuantificar y comparar las superficies asociadas;
- analizar las tasas de cambio registradas;
- identificar patrones territoriales;
- localizar espacialmente las transformaciones mediante GeoJSON.

Los resultados **no permiten por sí solos establecer las causas de la expansión urbana ni pronosticar su comportamiento futuro**.

El conjunto de datos tampoco contiene información sobre siniestros, pérdidas económicas o exposición asegurada. Por ello, cualquier aplicación en análisis de riesgos o seguros requeriría integrar fuentes adicionales.

---

## Tecnologías

- MongoDB
- MongoDB Shell (`mongosh`)
- GeoJSON
- JavaScript
- Git
- GitHub

---

## Estructura del repositorio

```text
proyecto-cambio-uso-suelo/
│
├── README.md
│
├── data/
│   ├── raw/
│   │   └── tasa_cambio_uso_suelo.geojson
│   └── processed/
│
├── scripts/
│   ├── 01_carga_datos.js
│   ├── 02_transformacion.js
│   ├── 03_consultas.js
│   ├── 04_indices.js
│   ├── 05_validacion.js
│   └── 06_geoespacial.js
│
├── docs/
│   ├── diccionario_datos.md
│   └── modelo_documental.md
│
└── evidencias/
```

---

## Estado del proyecto

- [x] Definición del problema
- [x] Pregunta de investigación
- [x] Objetivos
- [x] Selección de la fuente de datos
- [x] Exploración inicial del GeoJSON
- [x] Diseño del modelo documental
- [x] Diccionario de datos
- [ ] Creación del repositorio y estructura
- [ ] Carga de datos originales
- [ ] Transformación al modelo documental
- [ ] Consultas base
- [ ] Diseño de índices
- [ ] Evaluación con `explain("executionStats")`
- [ ] Implementación de `$jsonSchema`
- [ ] Pruebas de validación
- [ ] Índice geoespacial `2dsphere`
- [ ] Consultas geoespaciales
- [ ] Interpretación de resultados
- [ ] Conclusiones
