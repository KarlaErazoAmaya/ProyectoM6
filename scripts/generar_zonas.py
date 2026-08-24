#!/usr/bin/env python3
"""
Generador de las zonas de conservacion sinteticas del proyecto
"Expansion de los asentamientos humanos y transformacion del uso de suelo
en la Ciudad de Mexico".

Los poligonos son SINTETICOS. Su extension aproxima la distribucion general
del suelo de conservacion de la Ciudad de Mexico -concentrado en el sur y el
poniente- pero ningun vertice corresponde con un limite oficial. No deben
utilizarse para determinar si un predio real se encuentra dentro o fuera del
suelo de conservacion.

Motivo de la generacion: el conjunto de transiciones con el que se contrastan
es sintetico, de modo que su interseccion con los limites oficiales careceria
de significado. Ademas, los poligonos oficiales alcanzan decenas de miles de
vertices y suelen requerir simplificacion antes de admitir un indice 2dsphere.

Produce dos archivos:
  zonas_conservacion.json   3 zonas, formato JSONL
  casos_control_geo.json    4 transiciones de control con ubicacion conocida

Semilla fija: la ejecucion es reproducible.
"""

import json
import math
import random

SEMILLA = 20260824
ARCHIVO_ZONAS = "zonas_conservacion.json"
ARCHIVO_CONTROL = "casos_control_geo.json"

random.seed(SEMILLA)


def anillo_irregular(vertices_base, rugosidad=0.004, subdivisiones=3):
    """Devuelve un anillo cerrado y orientado en sentido antihorario.

    Interpola puntos intermedios entre los vertices base y los desplaza
    ligeramente, para que el borde no sea una linea recta. El desplazamiento
    es pequeno frente al tamano de la zona, de modo que el anillo no se
    autointerseca.
    """
    puntos = []
    n = len(vertices_base)
    for i in range(n):
        lon_a, lat_a = vertices_base[i]
        lon_b, lat_b = vertices_base[(i + 1) % n]
        for k in range(subdivisiones):
            t = k / subdivisiones
            lon = lon_a + (lon_b - lon_a) * t
            lat = lat_a + (lat_b - lat_a) * t
            if k > 0:
                lon += random.uniform(-rugosidad, rugosidad)
                lat += random.uniform(-rugosidad, rugosidad)
            puntos.append([round(lon, 6), round(lat, 6)])

    if area_con_signo(puntos) > 0:
        puntos.reverse()

    puntos.append(puntos[0])
    return [puntos]


def area_con_signo(puntos):
    """Formula del cordon. Positiva si el anillo va en sentido horario segun
    el convenio de la formula empleada; MongoDB espera el anillo exterior en
    sentido antihorario."""
    total = 0.0
    for i in range(len(puntos)):
        x1, y1 = puntos[i]
        x2, y2 = puntos[(i + 1) % len(puntos)]
        total += (x2 - x1) * (y2 + y1)
    return total


# --- Zonas ---------------------------------------------------------------
#
# La caja envolvente de la Ciudad de Mexico en la fuente real abarca
# longitud -99.3649 a -98.9403 y latitud 19.0482 a 19.5938. Las zonas se
# situan en la mitad sur, que es donde se concentra el suelo de conservacion.

ZONAS = [
    {
        "_id": "ZC-01",
        "nombre": "Sierra del Ajusco",
        "alcaldias": ["Milpa Alta", "Tlalpan", "Xochimilco"],
        "vertices": [
            (-99.32, 19.28), (-99.24, 19.31), (-99.16, 19.28),
            (-99.08, 19.22), (-98.99, 19.16), (-98.96, 19.10),
            (-99.04, 19.06), (-99.16, 19.05), (-99.27, 19.09),
            (-99.34, 19.17)
        ]
    },
    {
        "_id": "ZC-02",
        "nombre": "Sierra de las Cruces",
        "alcaldias": ["Cuajimalpa de Morelos", "La Magdalena Contreras",
                      "Álvaro Obregón"],
        "vertices": [
            (-99.36, 19.42), (-99.30, 19.41), (-99.25, 19.36),
            (-99.26, 19.32), (-99.32, 19.31), (-99.36, 19.35)
        ]
    },
    {
        "_id": "ZC-03",
        "nombre": "Chinampería de Xochimilco y Tláhuac",
        "alcaldias": ["Xochimilco", "Tláhuac"],
        "vertices": [
            (-99.10, 19.31), (-99.03, 19.32), (-98.96, 19.30),
            (-98.94, 19.26), (-99.00, 19.24), (-99.08, 19.26)
        ]
    }
]


def construir_zonas():
    documentos = []
    for zona in ZONAS:
        documentos.append({
            "_id": zona["_id"],
            "nombre": zona["nombre"],
            "categoria": "Suelo de conservación",
            "alcaldias": zona["alcaldias"],
            "geometria": {
                "type": "Polygon",
                "coordinates": anillo_irregular(zona["vertices"])
            }
        })
    return documentos


# --- Casos de control -----------------------------------------------------
#
# Transiciones cuya ubicacion respecto de ZC-01 se conoce de antemano. Sirven
# para comprobar que el operador espacial hace lo que se espera antes de
# aplicarlo al conjunto completo.

def cuadro(lon, lat, lado=0.012):
    """Cuadrado pequeno, cerrado y en sentido antihorario."""
    puntos = [
        [round(lon, 6), round(lat, 6)],
        [round(lon + lado, 6), round(lat, 6)],
        [round(lon + lado, 6), round(lat + lado, 6)],
        [round(lon, 6), round(lat + lado, 6)]
    ]
    if area_con_signo(puntos) > 0:
        puntos.reverse()
    puntos.append(puntos[0])
    return {"type": "Polygon", "coordinates": [puntos]}


def transicion(identificador, geometria, uso_actual, alcaldias, nota):
    return {
        "_id": identificador,
        "usoPrevio": "Agricultura de temporal",
        "usoActual": uso_actual,
        "superficie": {
            "usoPrevioHa": 210.5,
            "usoActualHa": 244.8,
            "areaTransicionM2": 2105000.5
        },
        "cambio": {
            "descripcion": "Agricultura de temporal -" + uso_actual,
            "tasa": 6.4,
            "clasificacionUso": 5 if uso_actual == "Asentamientos humanos" else 3,
            "clasificacionTasa": 4
        },
        "referencias": {"serieInicialId": 2, "serieFinalId": 5},
        "alcaldias": alcaldias,
        "longitudGeometria": 5300.5,
        "geometria": geometria,
        "_nota": nota
    }


CONTROL = [
    transicion(
        990001,
        cuadro(-99.14, 19.14),
        "Asentamientos humanos",
        ["Tlalpan"],
        "Contenida por completo en ZC-01. Debe aparecer con $geoIntersects y "
        "tambien con $geoWithin."
    ),
    transicion(
        990002,
        cuadro(-99.20, 19.288),
        "Asentamientos humanos",
        ["Tlalpan"],
        "Cruza el borde norte de ZC-01. Debe aparecer con $geoIntersects y "
        "NO con $geoWithin: es el caso que distingue ambos operadores."
    ),
    transicion(
        990003,
        cuadro(-99.14, 19.48),
        "Asentamientos humanos",
        ["Gustavo A. Madero"],
        "Situada al norte, lejos de cualquier zona. No debe aparecer con "
        "ningun operador espacial."
    ),
    transicion(
        990004,
        cuadro(-99.10, 19.12),
        "Vegetación secundaria",
        ["Tlalpan"],
        "Contenida en ZC-01 pero su uso posterior no es asentamientos "
        "humanos. Satisface la condicion espacial y no la tematica: debe "
        "quedar excluida al anadir el filtro por usoActual."
    )
]


def main():
    with open(ARCHIVO_ZONAS, "w", encoding="utf-8") as salida:
        for documento in construir_zonas():
            salida.write(json.dumps(documento, ensure_ascii=False) + "\n")

    with open(ARCHIVO_CONTROL, "w", encoding="utf-8") as salida:
        json.dump(CONTROL, salida, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
