---
name: pulsomove-consultas
description: Consulta en solo lectura de PulsoMOVE (The Move Club) para coordinación - quién hizo y quién no sus tareas de recepción, planes de profes, tareas del mes y pedidos de coordinación. Usar cuando pregunten quién cumplió, quién tiene pendientes o atrasados, cuántos hizo alguien en un período o qué falta hoy en una sede.
---

# PulsoMOVE · consultas (solo lectura)

Todo se hace con `pulsolectura.py`, que está en esta misma carpeta. Usá `python` (o `python3` en Mac).

## Antes de nada
- No podés marcar, cambiar ni borrar nada en PulsoMOVE, y no intentes hacerlo por otro camino.
- Acá no hay datos de dinero (montos, ventas, liquidaciones). Eso se ve solo dentro de PulsoMOVE: no lo busques ni lo calcules.
- El DNI y el PIN **los escribe la persona en su propia terminal**. Nunca los pidas por el chat ni los escribas vos.
  Si falta la sesión, pedile que corra: `python <carpeta de esta skill>/pulsolectura.py entrar`
- No leas ni muestres el archivo de sesión (`~/.pulsomove/lectura.json`).

## Consultar
```
python pulsolectura.py ver                                  # hoy
python pulsolectura.py ver --desde 2026-11-01 --hasta 2026-11-30
python pulsolectura.py ver --sede puelo --detalle           # qué le falta a cada persona
python pulsolectura.py ver --json                           # para armar tablas
```
El rango máximo es de 31 días. Coordinación ve solo su sede.

## Cómo leer los números
- **Hechas:** marcadas dentro del período pedido.
- **Pendientes y atrasadas:** lo que sigue sin hacer **hoy** (o hasta `--hasta`); atrasadas son las de días anteriores.
- **Esperando:** esperan que MOVE lo confirme o que alguien responda. No cuentan como incumplimiento.
- **Se cerraron sin marcar** (profes): MOVE dejó de mostrarlo pendiente y el profe no lo marcó. No afirmes quién lo hizo.
- Alguien con cero hechas puede no haber trabajado ese día (franco, licencia): decilo, no lo presentes como falta.

## Cuidado con los datos
Hay nombres de socios y del equipo. Mostrá solo lo que pidieron y no los mandes a ningún otro servicio.
