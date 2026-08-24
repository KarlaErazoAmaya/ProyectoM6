# Estrategia de indexación y comparación antes / después

Colección `cambios_uso_suelo` · 50 000 documentos · MongoDB Community 4.4.29

Las tres consultas conservan exactamente la misma forma que en la medición
inicial. Sólo cambió el conjunto de índices disponibles, de modo que las
diferencias observadas son atribuibles a esa decisión.

## Índices creados

```javascript
db.cambios_uso_suelo.createIndex(
  { usoActual: 1, usoPrevio: 1, "cambio.tasa": -1 },
  { name: "uso_tasa" }
);

db.cambios_uso_suelo.createIndex(
  { usoActual: 1, alcaldias: 1 },
  { name: "uso_alcaldias" }
);

db.cambios_uso_suelo.createIndex(
  { usoActual: 1, "cambio.tasa": -1 },
  { name: "uso_tasa_orden" }
);
```

| Índice | Consulta que apoya | Multikey | Tamaño |
|---|---|---|---:|
| `uso_tasa` | B | No | 930 KB |
| `uso_tasa_orden` | A | No | 909 KB |
| `uso_alcaldias` | C | Sí (`alcaldias`) | 405 KB |
| `_id_` (automático) | — | No | 537 KB |

### Justificación del orden de los campos

En los tres se aplica el criterio igualdad → ordenamiento → rango. Los campos
de igualdad ocupan las primeras posiciones porque acotan el bloque de entradas
a recorrer; el campo de rango u ordenamiento va al final, ya que una vez abierto
un rango las claves posteriores dejan de estar ordenadas de forma aprovechable
dentro de él.

En `uso_alcaldias`, `usoActual` precede al arreglo para no recorrer entradas de
todas las categorías antes de filtrar por uso.

La dirección `-1` de `cambio.tasa` corresponde al ordenamiento descendente de la
consulta A. Al ser la última clave, `1` también permitiría recorrer el índice en
sentido inverso; se declara explícitamente para dejar constancia del patrón que
atiende.

### Índice multikey

`uso_alcaldias` es multikey porque `alcaldias` es un arreglo. MongoDB genera una
entrada por elemento: con 34 096 documentos de una alcaldía, 12 864 de dos y
3 040 de tres, el índice contiene alrededor de 68 984 entradas para 50 000
documentos.

La restricción a considerar es que **un índice compuesto no admite más de un
campo de arreglo**. Si en el futuro se necesitara indexar `alcaldias` junto con
otro arreglo, la creación fallaría y habría que resolverlo con índices separados.

Pese a la amplificación, `uso_alcaldias` es el índice más pequeño de los tres:
almacena nombres de alcaldía y un campo menos que los otros dos, que guardan
cadenas largas de categorías de uso. Multikey implica más entradas, no
necesariamente más bytes.

## Comparación antes y después

| Consulta | Plan antes | Plan después | Índice | Claves | Documentos | Resultados |
|---|---|---|---|---:|---:|---:|
| A | SORT ← COLLSCAN | FETCH ← IXSCAN | `uso_tasa_orden` | 14 347 | 50 000 → 14 347 | 14 347 |
| B | COLLSCAN | FETCH ← IXSCAN | `uso_tasa` | 1 880 | 50 000 → 1 880 | 1 880 |
| C | COLLSCAN | FETCH ← IXSCAN | `uso_alcaldias` | 1 196 | 50 000 → 1 196 | 1 196 |

`nReturned` es idéntico antes y después en las tres consultas: 14 347, 1 880 y
1 196. El conjunto de resultados no cambió.

### Evolución de la consulta A

La consulta A requirió dos iteraciones y su recorrido documenta dos mejoras
independientes.

| | Sin índices | Con `uso_tasa` | Con `uso_tasa_orden` |
|---|---|---|---|
| Plan | SORT ← COLLSCAN | FETCH ← SORT ← IXSCAN | FETCH ← IXSCAN |
| `totalDocsExamined` | 50 000 | 14 347 | 14 347 |
| Bytes ordenados en memoria | 10 805 007 | 1 151 593 | 0 |
| `works` | 64 350 | 28 696 | 14 348 |
| `executionTimeMillis` | 43 | 138 | 52 |

Con `uso_tasa` la etapa `SORT` no desapareció. Los límites del índice muestran
por qué: `usoPrevio: [MinKey, MaxKey]` indica que el motor recorre todos los
valores de ese campo, de modo que las tasas de los distintos subbloques quedan
intercaladas y el orden global se pierde. El índice sí redujo la lectura de
50 000 a 14 347 documentos y el volumen a ordenar en un 89 %, porque ordena
claves del índice y no documentos completos: el atributo `type` del `SORT` pasa
de `simple` a `default`.

`uso_tasa_orden` coloca `cambio.tasa` inmediatamente después de la igualdad, con
lo que el índice entrega los documentos ya ordenados y la etapa `SORT`
desaparece. `works` se reduce a la mitad al eliminarse una etapa intermedia.

## Interpretación

Las tres consultas pasan de recorrer la colección completa a examinar
únicamente las entradas que satisfacen el filtro. En B y C se alcanza la
relación óptima: `totalKeysExamined` = `totalDocsExamined` = `nReturned`. El
índice no examina ninguna clave de más y `seeks: 1` confirma que el motor entra
una vez y recorre un bloque contiguo.

La reducción de trabajo es mayor donde el filtro es más selectivo. B devuelve el
3.8 % de la colección y C el 2.4 %, con reducciones del 96 % y 97.6 % en
documentos examinados. A devuelve el 28.7 % y su ganancia proviene sobre todo de
eliminar el ordenamiento, no del filtrado.

`executionTimeMillis` es la métrica menos estable de la tabla. En A subió de
43 ms a 138 ms con el primer índice, pese a que el trabajo medido disminuyó: el
plan realiza 14 347 accesos individuales a documentos a través del índice,
mientras que el `COLLSCAN` los leía de forma secuencial. Con una selectividad
del 28.7 % la lectura secuencial puede resultar competitiva aunque examine más
documentos. Los conteos de claves y documentos son los que sostienen la
comparación; el tiempo depende de la caché y de la actividad de la máquina.

### Los tres índices son distinguibles

Los `rejectedPlans` de cada consulta muestran que el planificador evaluó los
tres índices y descartó los que no correspondían.

En A descartó `uso_tasa` porque obligaba a una etapa `SORT`. En B descartó
`uso_tasa_orden`: ese plan incorpora un `filter` sobre `usoPrevio` en la etapa
`FETCH`, es decir, acota por uso y tasa, recupera los documentos y sólo después
descarta los que no corresponden al uso previo buscado. `uso_tasa` acota los
tres campos en los propios límites del índice y no deja filtro residual.

`uso_tasa` y `uso_tasa_orden` comparten el prefijo `usoActual` pero difieren en
la segunda clave, de modo que no son intercambiables: cada uno resuelve sin
trabajo adicional la consulta para la que fue diseñado.

En C, `dupsTested: 1196` con `dupsDropped: 0` es la huella del índice multikey.
El motor comprueba duplicados porque un documento puede aportar varias entradas,
y no descarta ninguno porque cada documento contiene "Xochimilco" una sola vez.

### Costo

Los tres índices secundarios suman 2 244 KB sobre una colección de
aproximadamente 34 MB, cerca del 6.5 % adicional en almacenamiento.

El costo relevante no es el disco sino la escritura: cada inserción,
actualización o borrado debe mantener los cuatro índices existentes. Una
modificación del arreglo `alcaldias` reescribe entre una y tres entradas de ese
documento. En una carga de escritura intensiva ese sobrecosto sería el factor a
vigilar, y convendría reevaluar si las tres consultas justifican mantener tres
índices.

No se creó ningún índice sobre `superficie`, `cambio.clasificacionUso` ni
`referencias`, porque ninguna de las consultas seleccionadas los utiliza como
filtro. Tampoco se creó el índice `2dsphere` sobre `geometria`: corresponde al
componente geoespacial y debe derivarse de una consulta espacial propia, no
anticiparse.

## Límite de esta evidencia

La medición se obtuvo sobre un conjunto sintético de 50 000 documentos, en una
instancia local de MongoDB Community 4.4.29 sin carga concurrente. Sustenta las
decisiones de indexación en ese entorno. No demuestra que los mismos índices
mejoren otras consultas, otro volumen ni una carga de trabajo distinta, y un
plan de ejecución admitido en este motor no debe atribuirse a Amazon DocumentDB
sin una comprobación independiente en la versión objetivo.

## Reproducción

```bash
bash ~/m6-nosql/setup/conectar.sh     # iniciar MongoDB; salir con exit
cd ~/ProyectoM6
bash scripts/01_carga_datos.sh
~/m6-nosql/.tools/bin/mongosh "mongodb://127.0.0.1:27017/m6_nosql" \
  --quiet scripts/02_consultas_base.js > evidencias/medicion_inicial.txt
~/m6-nosql/.tools/bin/mongosh "mongodb://127.0.0.1:27017/m6_nosql" \
  --quiet scripts/03_indices.js > evidencias/medicion_posterior.txt
```

`01_carga_datos.sh` elimina la colección antes de cargar, de modo que la
comparación parte siempre del mismo estado y los índices se crean desde cero.
