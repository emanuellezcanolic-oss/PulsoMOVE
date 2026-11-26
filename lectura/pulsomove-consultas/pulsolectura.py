#!/usr/bin/env python3
"""Consulta de solo lectura de PulsoMOVE para coordinación: quién hizo y quién no.

  python pulsolectura.py entrar                      # pide DNI y PIN en la terminal (lo escribe la persona)
  python pulsolectura.py ver [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD] [--sede bolson|puelo|bariloche] [--detalle] [--json]
  python pulsolectura.py salir

No puede marcar, cambiar ni borrar nada: el servidor rechaza el pase de lectura en todo lo demás.
"""
import argparse, getpass, json, os, sys, urllib.request

URL = 'https://script.google.com/macros/s/AKfycbwzgWvyTGmSLNXpywgF6-rt0MOJnEJreqw_WT5T9JJJM8zcrzgNM4ZslErh892siKeo/exec'
SESION = os.path.join(os.path.expanduser('~'), '.pulsomove', 'lectura.json')
SEDES = {'bariloche': 'Bariloche', 'bolson': 'El Bolsón', 'puelo': 'Lago Puelo'}
ERRORES = {
    'credenciales': 'DNI o PIN incorrectos.',
    'bloqueado': 'Demasiados intentos. Esperá unos minutos.',
    'prohibido': 'Tu usuario no tiene acceso de consulta (o pediste otra sede). Lo habilita Emanuel desde Equipo.',
    'sin_sesion': 'El acceso venció o te lo quitaron. Volvé a entrar: python pulsolectura.py entrar',
    'debe_cambiar_pin': 'Primero entrá a la app y cambiá el PIN.',
    'datos_invalidos': 'Fechas o sede inválidas (el rango máximo es de 31 días).',
}


def pedir(cuerpo):
    req = urllib.request.Request(URL, data=json.dumps(cuerpo).encode('utf-8'), headers={'Content-Type': 'text/plain;charset=utf-8'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            resp = json.loads(r.read().decode('utf-8'))
    except (OSError, ValueError):
        sys.exit('No se pudo hablar con PulsoMOVE. Revisá internet y probá de nuevo.')
    if not resp.get('ok'):
        sys.exit(ERRORES.get(resp.get('error'), f"PulsoMOVE no respondió bien ({resp.get('error')}). Probá en un minuto."))
    return resp['data']


def guardar(token):
    os.makedirs(os.path.dirname(SESION), exist_ok=True)
    with open(os.open(SESION, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w', encoding='utf-8') as f:
        json.dump({'token': token}, f)


def leer_token():
    try:
        with open(SESION, encoding='utf-8') as f:
            return json.load(f)['token']
    except (OSError, ValueError, KeyError):
        sys.exit('Todavía no entraste. Abrí una terminal y corré: python pulsolectura.py entrar')


def entrar():
    if not sys.stdin.isatty():
        sys.exit('El DNI y el PIN los escribe la persona en su propia terminal, no el asistente.')
    d = pedir({'accion': 'lectura_entrar', 'dni': input('DNI (sin puntos): ').strip(), 'pin': getpass.getpass('PIN (no se ve al escribir): ').strip()})
    guardar(d['token'])
    print(f"Listo, {d['nombre']}. Acceso de solo lectura por {d['dias']} días.")


def texto(d, detalle=False):
    periodo = d['desde'] if d['desde'] == d['hasta'] else f"{d['desde']} a {d['hasta']}"
    out = [f"PulsoMOVE · hechas del {periodo} · pendientes al día de hoy ({d['hoy']}) · " + ', '.join(SEDES.get(s, s) for s in d['sedes'])]

    def persona(p, extra=''):
        out.append(f"- {p['nombre']} ({SEDES.get(p['sede'], p['sede'])}): {p['hechas']} hechas, {p['pendientes']} pendientes, {p['atrasadas']} atrasadas{extra}")
        if detalle:
            for t in p['sin_hacer']:
                out.append(f"    {t['fecha']}  {t['tipo']}  {t['socio']}")
            if p['pendientes'] > len(p['sin_hacer']):
                out.append(f"    … y {p['pendientes'] - len(p['sin_hacer'])} más")

    out.append('\nRECEPCIÓN')
    for p in d['recepcion']:
        persona(p, f", {p['esperando']} esperando MOVE o respuesta" if p['esperando'] else '')
    out.append('\nPROFES (planes)')
    for p in d['profes']:
        m = p['tareas_del_mes']
        persona(p, (f", {p['cerradas_sin_marcar']} se cerraron sin marcar" if p['cerradas_sin_marcar'] else '') + (f", tareas del mes {m['hechas']}/{m['total']}" if m['total'] else ''))
        if detalle and m['faltan']:
            out.append('    tareas del mes sin hacer: ' + '; '.join(m['faltan']))
    if d['pedidos']:
        out.append('\nPEDIDOS DE COORDINACIÓN')
        for p in d['pedidos']:
            out.append(f"- {p['titulo']} ({p['estado']}): hicieron {len(p['hicieron'])} de {p['cantidad']}" + (f" · faltan {', '.join(p['faltan'])}" if p['faltan'] else ''))
    return '\n'.join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(prog='pulsolectura', description='PulsoMOVE en solo lectura')
    sub = ap.add_subparsers(dest='orden', required=True)
    sub.add_parser('entrar')
    sub.add_parser('salir')
    v = sub.add_parser('ver')
    v.add_argument('--desde')
    v.add_argument('--hasta')
    v.add_argument('--sede', choices=sorted(SEDES))
    v.add_argument('--detalle', action='store_true', help='lista qué le falta a cada persona')
    v.add_argument('--json', action='store_true')
    a = ap.parse_args(argv)
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if a.orden == 'entrar':
        return entrar()
    if a.orden == 'salir':
        if os.path.exists(SESION):
            os.remove(SESION)
        return print('Sesión de consulta borrada de esta computadora.')
    d = pedir({'accion': 'lectura', 'token': leer_token(), **{k: x for k, x in (('desde', a.desde), ('hasta', a.hasta), ('sede', a.sede)) if x}})
    print(json.dumps(d, ensure_ascii=False, indent=1) if a.json else texto(d, a.detalle))


if __name__ == '__main__':
    main()
