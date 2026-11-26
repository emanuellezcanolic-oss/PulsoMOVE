"""python -m pytest -q lectura/prueba_pulsolectura.py"""
import os, sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pulsomove-consultas'))
import pulsolectura as P

DATOS = {'hoy': '2026-11-12', 'desde': '2026-11-12', 'hasta': '2026-11-12', 'sedes': ['bolson'],
         'recepcion': [{'nombre': 'Ana', 'sede': 'bolson', 'turno': 'manana', 'hechas': 1, 'pendientes': 3, 'atrasadas': 1, 'esperando': 2,
                        'sin_hacer': [{'fecha': '2026-11-10', 'tipo': 'Renovación', 'socio': 'Socio Uno'}]}],
         'profes': [{'nombre': 'Belén', 'sede': 'bolson', 'hechas': 0, 'pendientes': 0, 'atrasadas': 0, 'cerradas_sin_marcar': 1, 'sin_hacer': [],
                     'tareas_del_mes': {'mes': '2026-11', 'hechas': 1, 'total': 2, 'faltan': ['Ordenar sala']}}],
         'pedidos': [{'titulo': 'Limpieza', 'estado': 'activo', 'cierra': '2026-11-18', 'hicieron': [], 'faltan': ['Ana'], 'cantidad': 1}]}


def test_resumen_dice_quien_hizo_y_quien_no():
    t = P.texto(DATOS)
    assert 'Ana (El Bolsón): 1 hechas, 3 pendientes, 1 atrasadas, 2 esperando' in t
    assert 'tareas del mes 1/2' in t and 'faltan Ana' in t
    assert 'Socio Uno' not in t                                  # los socios solo con --detalle
    d = P.texto(DATOS, True)
    assert 'Socio Uno' in d and 'y 2 más' in d


def test_el_asistente_no_puede_escribir_el_pin(monkeypatch):
    monkeypatch.setattr(P.sys.stdin, 'isatty', lambda: False, raising=False)
    monkeypatch.setattr(P, 'pedir', lambda c: pytest.fail('no tenía que pedir nada'))
    with pytest.raises(SystemExit):
        P.entrar()


def test_solo_conoce_las_dos_acciones_de_lectura():
    codigo = open(P.__file__, encoding='utf-8').read()
    import re
    assert set(re.findall(r"'accion': '([a-z_]+)'", codigo)) == {'lectura_entrar', 'lectura'}


def test_sin_sesion_avisa_como_entrar(monkeypatch, tmp_path):
    monkeypatch.setattr(P, 'SESION', str(tmp_path / 'no_esta.json'))
    with pytest.raises(SystemExit) as e:
        P.main(['ver'])
    assert 'entrar' in str(e.value)
