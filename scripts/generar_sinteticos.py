#!/usr/bin/env python3
"""
Generador del conjunto de datos sintetico del proyecto
"Expansion de los asentamientos humanos y transformacion del uso de suelo
en la Ciudad de Mexico".

Los datos son SINTETICOS. Reproducen la estructura, las categorias y los
intervalos observados en el conjunto real "Tasa de cambio de uso de suelo y
vegetacion en la Ciudad de Mexico" (Portal de Datos Abiertos de la CDMX,
44 registros, periodo 1992-2016), pero ningun documento corresponde con un
registro real de la fuente.

Motivo de la generacion: el conjunto original contiene 44 registros, de los
cuales solo 7 son transiciones hacia asentamientos humanos. Ese volumen no
permite observar diferencias interpretables en explain("executionStats"), ni
comparar planes de ejecucion antes y despues de indexar.

Semilla fija: la ejecucion es reproducible.
"""

import json
import math
import random

SEMILLA = 20260823
N_DOCUMENTOS = 50000
ARCHIVO_SALIDA = "cambios_uso_suelo_sintetico.json"
ARCHIVO_PRUEBAS = "casos_validador.json"

random.seed(SEMILLA)

# --- Categorias observadas en la fuente real -----------------------------

CATEGORIAS = [
    "Agricultura de riego",
    "Agricultura de temporal",
    "Asentamientos humanos",
    "Cuerpos de agua",
    "Pastizal inducido o cultivado",
    "Plantaciones forestales",
    "Vegetación primaria",
    "Vegetación secundaria",
]

# Pesos del uso previo. Reproducen que la agricultura y la vegetacion
# concentran la superficie susceptible de transformarse.
PESOS_USO_PREVIO = [18, 22, 12, 4, 14, 6, 12, 12]

ALCALDIAS = [
    "Álvaro Obregón", "Azcapotzalco", "Benito Juárez", "Coyoacán",
    "Cuajimalpa de Morelos", "Cuauhtémoc", "Gustavo A. Madero",
    "Iztacalco", "Iztapalapa", "La Magdalena Contreras", "Miguel Hidalgo",
    "Milpa Alta", "Tláhuac", "Tlalpan", "Venustiano Carranza", "Xochimilco",
]

# Caja envolvente de la Ciudad de Mexico, tomada de la fuente real.
LON_MIN, LON_MAX = -99.3649, -98.9403
LAT_MIN, LAT_MAX = 19.0482, 19.5938


def poligono(centro_lon, centro_lat, radio_grados, vertices):
    """Devuelve un anillo GeoJSON cerrado y orientado en sentido antihorario.

    El sentido antihorario del anillo exterior es la convencion que MongoDB
    espera para 2dsphere: define que el interior del poligono es la region
    acotada y no su complemento sobre la esfera.
    """
    puntos = []
    paso = 2 * math.pi / vertices
    for i in range(vertices):
        angulo = i * paso
        # Irregularidad controlada para que los poligonos no sean identicos.
        r = radio_grados * random.uniform(0.72, 1.28)
        lon = centro_lon + r * math.cos(angulo) / math.cos(math.radians(centro_lat))
        lat = centro_lat + r * math.sin(angulo)
        puntos.append([round(lon, 6), round(lat, 6)])
    puntos.append(puntos[0])  # cierre del anillo
    return [puntos]


def clasificar_tasa(tasa):
    """Clasificacion 0-5 derivada del valor de la tasa, como en la fuente."""
    if tasa <= -10:
        return 0
    if tasa <= -3:
        return 1
    if tasa < 0:
        return 2
    if tasa < 3:
        return 3
    if tasa < 10:
        return 4
    return 5


def clasificar_uso(previo, actual):
    """0 cuando no hay cambio de categoria; 1-5 segun el tipo de transicion."""
    if previo == actual:
        return 0
    if actual == "Asentamientos humanos":
        return 5
    if actual == "Cuerpos de agua":
        return 4
    if previo == "Asentamientos humanos":
        return 1
    if actual in ("Vegetación primaria", "Vegetación secundaria",
                  "Plantaciones forestales"):
        return 2
    return 3


def generar_documento(identificador):
    previo = random.choices(CATEGORIAS, weights=PESOS_USO_PREVIO, k=1)[0]

    # Alrededor del 20 % de las transiciones desembocan en asentamientos
    # humanos: es la poblacion de interes del proyecto y conviene que sea
    # selectiva sin ser marginal.
    if random.random() < 0.20:
        actual = "Asentamientos humanos"
    else:
        actual = random.choices(CATEGORIAS, weights=PESOS_USO_PREVIO, k=1)[0]

    if previo == actual:
        tasa = round(random.uniform(-2.5, 2.5), 6)
    elif actual == "Asentamientos humanos":
        # Las transformaciones hacia asentamientos humanos tienden a tasas
        # mas altas, pero el intervalo real incluye valores negativos.
        tasa = round(random.uniform(-8.0, 25.29), 6)
    else:
        tasa = round(random.uniform(-18.35, 18.0), 6)

    superficie_previa = round(random.lognormvariate(6.4, 1.55), 6)
    superficie_previa = min(superficie_previa, 35471.606964)
    factor = math.exp(tasa / 100.0 * random.uniform(0.8, 1.2))
    superficie_actual = round(min(superficie_previa * factor, 35471.606964), 6)

    centro_lon = round(random.uniform(LON_MIN, LON_MAX), 6)
    centro_lat = round(random.uniform(LAT_MIN, LAT_MAX), 6)
    radio = random.uniform(0.0025, 0.022)
    geometria = {
        "type": "Polygon",
        "coordinates": poligono(centro_lon, centro_lat, radio,
                                random.randint(5, 9)),
    }

    # Una transicion puede abarcar mas de una alcaldia. El arreglo permite
    # ejercer un indice multikey sobre un campo con significado real.
    n_alcaldias = random.choices([1, 2, 3], weights=[68, 26, 6], k=1)[0]
    alcaldias = sorted(random.sample(ALCALDIAS, n_alcaldias))

    documento = {
        "_id": identificador,
        "usoPrevio": previo,
        "usoActual": actual,
        "superficie": {
            "usoPrevioHa": superficie_previa,
            "usoActualHa": superficie_actual,
            "areaTransicionM2": round(superficie_previa * 10000
                                      * random.uniform(0.93, 1.07), 4),
        },
        "cambio": {
            "descripcion": previo + " -" + actual,
            "tasa": tasa,
            "clasificacionUso": clasificar_uso(previo, actual),
            "clasificacionTasa": clasificar_tasa(tasa),
        },
        "referencias": {
            "serieInicialId": random.randint(1, 6),
            "serieFinalId": random.randint(1, 6),
        },
        "alcaldias": alcaldias,
        "longitudGeometria": round(random.uniform(1200.0, 90000.0), 6),
        "geometria": geometria,
    }

    # La fuente real presenta 1 registro de 44 con uso, uso posterior y
    # descripcion nulos. Se conserva esa proporcion (~2.3 %) para que el
    # validador y las consultas enfrenten el caso.
    if random.random() < 0.023:
        documento["usoPrevio"] = None
        documento["usoActual"] = None
        documento["cambio"]["descripcion"] = None
        documento["cambio"]["clasificacionUso"] = 0

    return documento


def main():
    with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as salida:
        for i in range(1, N_DOCUMENTOS + 1):
            documento = generar_documento(i)
            salida.write(json.dumps(documento, ensure_ascii=False) + "\n")

    # Casos de prueba del validador: cada documento invalido aisla una sola
    # inconsistencia, como pide la guia de la semana 2.
    casos = [
        {
            "caso": "valido-01",
            "esperado": "aceptado",
            "regla": "cumple todos los requisitos del esquema",
            "documento": generar_documento(900001),
        },
        {
            "caso": "valido-02-nulos",
            "esperado": "aceptado",
            "regla": "usoPrevio y usoActual admiten null porque la fuente los presenta vacios",
            "documento": {
                "_id": 900002,
                "usoPrevio": None,
                "usoActual": None,
                "superficie": {"usoPrevioHa": 120.5, "usoActualHa": 118.2,
                               "areaTransicionM2": 1205000.0},
                "cambio": {"descripcion": None, "tasa": -0.9,
                           "clasificacionUso": 0, "clasificacionTasa": 2},
                "referencias": {"serieInicialId": 1, "serieFinalId": 3},
                "alcaldias": ["Tlalpan"],
                "longitudGeometria": 8400.0,
                "geometria": {"type": "Polygon", "coordinates":
                              poligono(-99.18, 19.28, 0.01, 6)},
            },
        },
        {
            "caso": "invalido-01-falta-geometria",
            "esperado": "rechazado",
            "regla": "required: geometria es obligatoria",
            "documento": {
                "_id": 900003,
                "usoPrevio": "Agricultura de riego",
                "usoActual": "Asentamientos humanos",
                "superficie": {"usoPrevioHa": 300.0, "usoActualHa": 340.0,
                               "areaTransicionM2": 3000000.0},
                "cambio": {"descripcion": "Agricultura de riego -Asentamientos humanos",
                           "tasa": 4.2, "clasificacionUso": 5,
                           "clasificacionTasa": 4},
                "referencias": {"serieInicialId": 1, "serieFinalId": 3},
                "alcaldias": ["Xochimilco"],
                "longitudGeometria": 5100.0,
            },
        },
        {
            "caso": "invalido-02-superficie-negativa",
            "esperado": "rechazado",
            "regla": "superficie.usoPrevioHa exige minimum: 0",
            "documento": {
                "_id": 900004,
                "usoPrevio": "Pastizal inducido o cultivado",
                "usoActual": "Asentamientos humanos",
                "superficie": {"usoPrevioHa": -15.0, "usoActualHa": 90.0,
                               "areaTransicionM2": 900000.0},
                "cambio": {"descripcion": "Pastizal inducido o cultivado -Asentamientos humanos",
                           "tasa": 6.1, "clasificacionUso": 5,
                           "clasificacionTasa": 4},
                "referencias": {"serieInicialId": 2, "serieFinalId": 4},
                "alcaldias": ["Milpa Alta"],
                "longitudGeometria": 4300.0,
                "geometria": {"type": "Polygon", "coordinates":
                              poligono(-99.02, 19.16, 0.008, 5)},
            },
        },
        {
            "caso": "invalido-03-categoria-fuera-de-enum",
            "esperado": "rechazado",
            "regla": "usoActual solo admite las categorias observadas en la fuente",
            "documento": {
                "_id": 900005,
                "usoPrevio": "Vegetación primaria",
                "usoActual": "Zona industrial",
                "superficie": {"usoPrevioHa": 210.0, "usoActualHa": 205.0,
                               "areaTransicionM2": 2100000.0},
                "cambio": {"descripcion": "Vegetación primaria -Zona industrial",
                           "tasa": -1.2, "clasificacionUso": 3,
                           "clasificacionTasa": 2},
                "referencias": {"serieInicialId": 1, "serieFinalId": 5},
                "alcaldias": ["Tlalpan"],
                "longitudGeometria": 6600.0,
                "geometria": {"type": "Polygon", "coordinates":
                              poligono(-99.21, 19.21, 0.009, 6)},
            },
        },
        {
            "caso": "invalido-04-tipo-de-geometria-no-admitido",
            "esperado": "rechazado",
            "regla": "geometria.type solo admite Polygon o MultiPolygon",
            "documento": {
                "_id": 900006,
                "usoPrevio": "Agricultura de temporal",
                "usoActual": "Asentamientos humanos",
                "superficie": {"usoPrevioHa": 480.0, "usoActualHa": 530.0,
                               "areaTransicionM2": 4800000.0},
                "cambio": {"descripcion": "Agricultura de temporal -Asentamientos humanos",
                           "tasa": 8.4, "clasificacionUso": 5,
                           "clasificacionTasa": 4},
                "referencias": {"serieInicialId": 2, "serieFinalId": 6},
                "alcaldias": ["Tláhuac"],
                "longitudGeometria": 7200.0,
                "geometria": {"type": "Point", "coordinates": [-98.96, 19.27]},
            },
        },
        {
            "caso": "invalido-05-tasa-como-cadena",
            "esperado": "rechazado",
            "regla": "cambio.tasa exige bsonType double",
            "documento": {
                "_id": 900007,
                "usoPrevio": "Cuerpos de agua",
                "usoActual": "Asentamientos humanos",
                "superficie": {"usoPrevioHa": 45.0, "usoActualHa": 60.0,
                               "areaTransicionM2": 450000.0},
                "cambio": {"descripcion": "Cuerpos de agua -Asentamientos humanos",
                           "tasa": "17.08", "clasificacionUso": 5,
                           "clasificacionTasa": 5},
                "referencias": {"serieInicialId": 3, "serieFinalId": 6},
                "alcaldias": ["Xochimilco"],
                "longitudGeometria": 2900.0,
                "geometria": {"type": "Polygon", "coordinates":
                              poligono(-99.10, 19.27, 0.006, 5)},
            },
        },
    ]

    with open(ARCHIVO_PRUEBAS, "w", encoding="utf-8") as salida:
        json.dump(casos, salida, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
