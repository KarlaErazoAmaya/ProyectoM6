# Zonas de conservación — procedencia y casos de control

## Naturaleza de los datos

Los tres polígonos de `zonas_conservacion.json` son **sintéticos**. Su extensión
aproxima la distribución general del suelo de conservación de la Ciudad de
México —concentrado en el sur y el poniente— pero **ningún vértice corresponde
con un límite oficial**.

No deben utilizarse para determinar si un predio real se encuentra dentro o
fuera del suelo de conservación, ni para sustentar ninguna afirmación sobre el
territorio de la Ciudad de México.

## Por qué son sintéticos

El conjunto de transiciones con el que se contrastan también lo es: sus
geometrías son polígonos generados dentro de la caja envolvente de la ciudad y
no corresponden con parcelas reales. Intersectarlas con los límites oficiales
produciría coincidencias arbitrarias, sin significado territorial ni técnico.

A esto se suma una razón práctica: los polígonos oficiales del portal alcanzan
decenas de miles de vértices y suelen requerir simplificación previa antes de
admitir un índice `2dsphere`.

La fuente oficial, para cuando el proyecto trabaje con el conjunto real de 44
registros, es el conjunto **Suelo de conservación** de la Secretaría del Medio
Ambiente, disponible en el Portal de Datos Abiertos de la Ciudad de México
(`https://datos.cdmx.gob.mx/dataset/suelo-de-conservacion`). Existe también un
conjunto de áreas comunitarias de conservación ecológica de Milpa Alta, Tlalpan
y Xochimilco, con geometrías más acotadas.

## Las tres zonas

| `_id` | Nombre | Alcaldías declaradas | Vértices |
|---|---|---|---:|
| `ZC-01` | Sierra del Ajusco | Milpa Alta, Tlalpan, Xochimilco | 31 |
| `ZC-02` | Sierra de las Cruces | Cuajimalpa, Magdalena Contreras, Álvaro Obregón | 19 |
| `ZC-03` | Chinampería de Xochimilco y Tláhuac | Xochimilco, Tláhuac | 19 |

Estructura de cada documento:

```javascript
{
  _id: "ZC-01",
  nombre: "Sierra del Ajusco",
  categoria: "Suelo de conservación",
  alcaldias: ["Milpa Alta", "Tlalpan", "Xochimilco"],
  geometria: {
    type: "Polygon",
    coordinates: [[[-99.34, 19.17], [-99.27, 19.09], ...]]
  }
}
```

## Comprobaciones realizadas

| Comprobación | Resultado |
|---|---|
| Geometrías válidas (Shapely `is_valid`) | 3 de 3; ninguna se autointerseca |
| Orientación del anillo exterior | Antihoraria en las tres, la convención que `2dsphere` espera |
| Anillos cerrados | El primer vértice se repite al final en las tres |
| Orden de coordenadas | Longitud–latitud, dentro de los intervalos válidos |
| Traslape entre zonas | Ninguno |

La ausencia de traslape importa: si dos zonas compartieran territorio, una
transición que cayera en la intersección aparecería dos veces al agregar por
zona y el conteo quedaría inflado.

## Resultados esperados sobre el conjunto de 50 000 transiciones

| Selección | Documentos | Porcentaje |
|---|---:|---:|
| Intersectan alguna zona (`$geoIntersects`) | 21 683 | 43.4 % |
| Contenidas por completo (`$geoWithin`) | 13 123 | 26.2 % |
| Intersectan **y** su uso posterior es asentamientos humanos | 6 286 | 12.6 % |

La diferencia de **8 560 documentos** entre los dos primeros renglones es la que
distingue ambos operadores: transiciones que cruzan el borde de una zona sin
quedar contenidas en ella. Si una consulta con `$geoIntersects` devolviera la
misma cantidad que con `$geoWithin`, el operador no estaría haciendo lo que se
espera.

## Casos de control

`casos_control_geo.json` contiene cuatro transiciones cuya ubicación respecto de
`ZC-01` se conoce de antemano. Sirven para comprobar el operador antes de
aplicarlo al conjunto completo.

| `_id` | Ubicación | `usoActual` | `$geoIntersects` | `$geoWithin` | Con filtro temático |
|---|---|---|:-:|:-:|:-:|
| 990001 | Contenida en ZC-01 | Asentamientos humanos | sí | sí | sí |
| 990002 | Cruza el borde norte | Asentamientos humanos | sí | **no** | sí |
| 990003 | Al norte, lejos de toda zona | Asentamientos humanos | no | no | no |
| 990004 | Contenida en ZC-01 | Vegetación secundaria | sí | sí | **no** |

Los cuatro casos cubren lo que pide la guía de la semana 3 en §3.8: un caso
dentro y otro fuera de la región, y un caso que satisface la condición espacial
pero no la temática.

`990002` es el más informativo: es el único que distingue `$geoIntersects` de
`$geoWithin`. Si apareciera con ambos, o con ninguno, el operador no está
representando la relación que se cree.

Cada documento incluye un campo `_nota` con la descripción de su papel. Conviene
eliminarlo antes de insertarlo, o declararlo en el validador, ya que no forma
parte del modelo.

## Reproducibilidad

`generar_zonas.py` usa la semilla fija `20260824`. Ejecutarlo de nuevo produce
exactamente los mismos polígonos:

```bash
python3 scripts/generar_zonas.py
```

## Carga

```bash
~/m6-nosql/.tools/bin/mongoimport \
  --uri "mongodb://127.0.0.1:27017/m6_nosql" \
  --collection zonas_conservacion \
  --file zonas_conservacion.json \
  --drop
```

## Límite de esta evidencia

Una superposición entre una transición y una zona indica **coincidencia
territorial**, no infracción, responsabilidad ni causa. El resultado depende
además de los límites tal como están registrados: otra escala, otra fuente o
otra fecha producirían un subconjunto distinto.

Sobre datos sintéticos, los conteos describen los polígonos generados y no el
territorio de la Ciudad de México.
