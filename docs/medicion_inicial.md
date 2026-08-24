# Medición inicial — antes de indexar

Colección `cambios_uso_suelo` · 50 000 documentos · MongoDB Community 4.4.29

Estado de partida: `getIndexes()` devuelve únicamente `_id_`. No existe ningún
índice secundario. Las tres consultas se ejecutaron con
`explain("executionStats")` y su forma se conserva sin cambios para la
comparación posterior.

## Consultas medidas

**A. Transiciones más intensas hacia asentamientos humanos**

```javascript
db.cambios_uso_suelo.find({ usoActual: "Asentamientos humanos" })
                    .sort({ "cambio.tasa": -1 })
```

**B. Urbanización sobre agricultura de temporal por encima del 5 %**

```javascript
db.cambios_uso_suelo.find({
  usoActual: "Asentamientos humanos",
  usoPrevio: "Agricultura de temporal",
  "cambio.tasa": { $gte: 5 }
})
```

**C. Transiciones que afectan a una alcaldía**

```javascript
db.cambios_uso_suelo.find({
  usoActual: "Asentamientos humanos",
  alcaldias: "Xochimilco"
})
```

## Resultados

| Métrica | A | B | C |
|---|---:|---:|---:|
| Etapa principal | COLLSCAN | COLLSCAN | COLLSCAN |
| Etapa SORT independiente | Sí | No | No |
| `nReturned` | 14 347 | 1 880 | 1 196 |
| `totalKeysExamined` | 0 | 0 | 0 |
| `totalDocsExamined` | 50 000 | 50 000 | 50 000 |
| `executionTimeMillis` | 43 | 27 | 30 |
| Documentos examinados por resultado | 3.5 | 26.6 | 41.8 |

## Interpretación

Las tres consultas recorren la colección completa. Ninguna dispone de un índice
que acote la búsqueda, de modo que el motor abre los 50 000 documentos y
descarta los que no cumplen el filtro. `totalKeysExamined` es 0 en los tres
casos porque no interviene ningún índice.

La relación entre documentos examinados y resultados devueltos mide el trabajo
desperdiciado. La consulta C es la más desfavorable: examina cerca de 42
documentos por cada uno que entrega.

La consulta A es la que ejecuta el plan más costoso. A la lectura completa se
suma una etapa `SORT` que ordena 14 347 documentos en memoria, con
`totalDataSizeSorted` de 10 805 007 bytes. `usedDisk` es `false`, así que la
operación cupo dentro del límite de 100 MB, pero consume alrededor de la décima
parte de ese presupuesto en una sola consulta. El contador `works` del `SORT`
asciende a 64 350 frente a los 50 002 del `COLLSCAN`: la diferencia corresponde
al costo del ordenamiento y puede atribuirse por separado.

La selectividad de los filtros difiere y conviene tenerlo presente al diseñar
los índices. B devuelve el 3.8 % de la colección y C el 2.4 %, mientras que A
devuelve el 28.7 %. Un filtro poco selectivo limita lo que un índice puede
ahorrar en la lectura, aunque sí permita suprimir la etapa de ordenamiento.

## Límite de esta evidencia

La medición se obtuvo sobre un conjunto sintético de 50 000 documentos, en una
instancia local de MongoDB Community 4.4.29 sin carga concurrente. Sustenta las
decisiones de indexación en ese entorno y no demuestra que los mismos índices
mejoren otras consultas, otro volumen o una carga de trabajo distinta.

`executionTimeMillis` es el dato menos estable de la tabla, ya que depende de la
memoria disponible y de la actividad de la máquina. Los conteos de documentos y
claves examinados son los que sostienen la comparación.

## Reproducción

```bash
bash ~/m6-nosql/setup/conectar.sh     # iniciar MongoDB; salir con exit
cd ~/ProyectoM6
bash scripts/01_carga_datos.sh
~/m6-nosql/.tools/bin/mongosh "mongodb://127.0.0.1:27017/m6_nosql" \
  --quiet scripts/02_consultas_base.js > evidencias/medicion_inicial.txt
```

`01_carga_datos.sh` elimina la colección antes de cargar, de modo que la
medición parte siempre del mismo estado.
