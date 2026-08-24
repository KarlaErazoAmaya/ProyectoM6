# Semana 4 — Análisis temporal

## Evaluación de pertinencia

El proyecto analiza transformaciones de uso de suelo hacia asentamientos humanos en la Ciudad de México a partir de una base que describe cambios entre series de uso de suelo y vegetación.

Aunque la fuente original documenta cambios ocurridos dentro de un periodo histórico, los documentos utilizados en el proyecto no contienen una marca temporal BSON `Date` asociada individualmente a cada transición.

Por esta razón, no nos resultó adecuado construir consultas por intervalo, agrupar por mes o año, ni generar indicadores temporales a partir de fechas artificiales, ya que esto introduciría información que no está contenida en la fuente.

## Decisión

Se decidió no implementar un análisis temporal específico.

En lugar de asignar fechas inventadas a los registros, se fortaleció el componente geoespacial del proyecto, ya que la geometría GeoJSON sí forma parte de los datos y permite responder directamente a la pregunta de investigación sobre la distribución espacial de las transformaciones hacia asentamientos humanos.

## Justificación

La guía del proyecto permite omitir el análisis temporal cuando el tiempo no aporta a la pregunta planteada, siempre que la decisión se justifique y se fortalezca otro componente especializado.

En este proyecto, el análisis geoespacial resulta más pertinente porque permite:

- identificar la ubicación de las transformaciones;
- relacionar polígonos de cambio con zonas territoriales;
- utilizar geometrías GeoJSON;
- crear un índice `2dsphere`;
- aplicar operadores geoespaciales como `$geoIntersects`.

## Alcance

La información disponible permite analizar las transformaciones registradas y su distribución espacial.

No permite reconstruir una serie temporal continua ni afirmar cómo evolucionó año con año la expansión de los asentamientos humanos, ya que los documentos no cuentan con una fecha individual de ocurrencia para cada transición.
