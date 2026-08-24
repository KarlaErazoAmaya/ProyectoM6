# Pipeline de indicadores dentro de zonas de conservación

Guía de avance, semana 3, §3.6 y §3.7.

Colección `cambios_uso_suelo` · 50 000 documentos · MongoDB Community 4.4.29

## Pregunta que responde

¿Qué usos de suelo se transformaron en asentamientos humanos dentro de las zonas
de conservación, y con qué superficie y tasas de cambio?

## Construcción progresiva

La consulta se construyó por etapas, comprobando la selección espacial antes de
incorporar filtros temáticos y antes de agrupar.

### Etapa 1 — selección espacial

```javascript
var zonas = db.zonas_conservacion.find({}, { geometria: 1 }).toArray()
  .map(function (z) {
    return { geometria: { $geoIntersects: { $geometry: z.geometria } } };
  });

db.cambios_uso_suelo.countDocuments({ $or: zonas })
```

Devuelve 21 683 documentos. El `$or` evita que un documento que tocara dos zonas
se contara dos veces; las zonas se construyeron sin traslape, de modo que el
caso no se presenta, pero la consulta es correcta con independencia de ello.

### Etapa 2 — filtro temático

```javascript
var filtro = {
  $or: zonas,
  usoActual: "Asentamientos humanos",
  usoPrevio: { $ne: "Asentamientos humanos" }
};

db.cambios_uso_suelo.countDocuments(filtro)
```

Devuelve 5 524 documentos.

La exclusión de `usoPrevio: "Asentamientos humanos"` no es cosmética. Sin ella,
la selección incluye 762 registros cuyo uso previo y posterior coinciden: no son
transformaciones, sino superficies que ya eran urbanas y siguieron siéndolo. Su
tasa promedio es −0.01, prácticamente nula, lo que confirma la ausencia de
cambio. Incorporarlos a un análisis sobre expansión urbana contaría como
transformación algo que no se transformó.

### Etapa 3 — agrupación

```javascript
db.cambios_uso_suelo.aggregate([
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
      tasaMinima: 1,
      tasaMaxima: 1
  } },
  { $sort: { transiciones: -1, usoPrevio: 1 } }
])
```

## Unidad de análisis

Cada fila del resultado corresponde a un **uso de suelo previo**, acotado a las
transiciones que intersectan alguna zona de conservación y cuyo uso posterior es
asentamientos humanos. No corresponde a una transición individual ni a una zona.

Las unidades de los indicadores son distintas y no deben confundirse:

| Indicador | Unidad |
|---|---|
| `transiciones` | Cantidad de polígonos de transición |
| `superficieTotalHa` | Hectáreas del uso previo, sumadas |
| `tasaPromedio` | Tasa de cambio por transición, promediada |
| `tasaMinima` / `tasaMaxima` | Tasa de cambio, valores extremos |

## Resultado

| Uso previo | Transiciones | Superficie total (ha) | Tasa promedio | Tasa mínima | Tasa máxima |
|---|---:|---:|---:|---:|---:|
| Agricultura de temporal | 1 372 | 2 723 765.53 | 8.49 | −7.97 | 25.28 |
| Agricultura de riego | 1 087 | 2 135 833.64 | 8.63 | −7.99 | 25.27 |
| Pastizal inducido o cultivado | 900 | 1 710 231.10 | 8.41 | −7.99 | 25.19 |
| Vegetación secundaria | 785 | 1 429 073.58 | 8.16 | −7.92 | 25.28 |
| Vegetación primaria | 751 | 1 309 548.14 | 8.60 | −8.00 | 25.22 |
| Plantaciones forestales | 399 | 724 732.50 | 8.09 | −7.96 | 25.19 |
| Cuerpos de agua | 230 | 411 893.75 | 8.76 | −7.99 | 25.27 |

Total: 5 524 transiciones en siete grupos.

El `$sort` emplea dos claves: `transiciones` descendente y, ante empate,
`usoPrevio` ascendente. `$group` no garantiza ningún orden de salida, de modo
que sin la segunda clave el resultado no sería determinista y no podría
compararse entre ejecuciones.

## Interpretación

El orden por cantidad de transiciones y el orden por superficie coinciden en
este resultado: los usos agrícolas encabezan ambos. Esa coincidencia no está
garantizada —un uso con pocas transiciones muy extensas podría invertir el
orden— y por eso conviene reportar los dos indicadores en lugar de uno solo.

Las tasas promedio son muy similares entre grupos, entre 8.09 y 8.76, y todos
los grupos abarcan prácticamente el mismo intervalo, de aproximadamente −8 a 25.
Esa uniformidad indica que la tasa no distingue a un uso previo de otro dentro
de este conjunto: lo que diferencia a los grupos es cuántas transiciones y
cuánta superficie, no con qué intensidad cambiaron.

## Límites de esta evidencia

**Un conteo no es una tasa.** 1 372 transiciones desde agricultura de temporal
no expresan una proporción mientras no exista un denominador de exposición:
cuánta superficie de agricultura de temporal había dentro de las zonas al
inicio del periodo. Sin ese dato no puede afirmarse que un uso sea más
vulnerable que otro, sólo que aparece más veces en el resultado.

**La superficie sumada no es superficie transformada.** `superficie.usoPrevioHa`
describe la extensión asociada al uso previo del registro, no el área concreta
que cambió de uso. Sumarla da una magnitud comparable entre grupos, no una
medición del terreno urbanizado.

**Una superposición no es una infracción.** Que una transición comparta espacio
con una zona de conservación indica coincidencia territorial. No implica
incumplimiento normativo, responsabilidad ni causa.

**Una asociación espacial no demuestra causalidad.** Que los usos agrícolas
encabecen el resultado no significa que la conservación provoque su
transformación, ni que la cercanía a una zona la favorezca. La distribución
puede reflejar simplemente dónde había más superficie agrícola.

**Los datos son sintéticos.** Tanto las transiciones como las zonas se generaron
para demostrar el funcionamiento de la solución. Los indicadores describen los
polígonos generados y no el territorio de la Ciudad de México. Las conclusiones
sobre el fenómeno urbano deben obtenerse del conjunto real de 44 registros.

**El resultado depende de los límites empleados.** Los polígonos oficiales de
suelo de conservación tienen bordes mucho más detallados que los sintéticos, y
esa diferencia afecta directamente qué transiciones se consideran superpuestas.

## Reproducción

```bash
bash ~/m6-nosql/setup/conectar.sh        # iniciar MongoDB; salir con exit
cd ~/ProyectoM6
```

Con las colecciones `cambios_uso_suelo` (50 000 documentos, sin casos de
control) y `zonas_conservacion` (3 documentos) cargadas, y el índice
`geometria_2dsphere` creado, las tres etapas se ejecutan en el orden anterior.

Los casos de control con `_id` mayor o igual a 990000 deben eliminarse antes de
ejecutar el pipeline: al pertenecer a la misma colección, alterarían los
conteos.

```javascript
db.cambios_uso_suelo.deleteMany({ _id: { $gte: 990000 } })
db.cambios_uso_suelo.countDocuments({})   // debe devolver 50000
```
