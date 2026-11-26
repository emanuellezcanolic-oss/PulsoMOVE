# Instalar las consultas de PulsoMOVE en tu Claude (coordinación)

Antes: Emanuel te habilita en PulsoMOVE → Equipo → **🔎 Consulta desde Claude: sí**. Necesitás Python 3 instalado.

1. Descomprimí `pulsomove-consultas.zip` dentro de la carpeta de skills de Claude:
   - Windows: `C:\Users\TU_USUARIO\.claude\skills\`
   - Mac: `~/.claude/skills/`
2. Tiene que quedar `…/.claude/skills/pulsomove-consultas/SKILL.md`.
3. Abrí una terminal en esa carpeta y entrá con tu DNI y tu PIN (los mismos de la app):
   - Windows: `python pulsolectura.py entrar`
   - Mac: `python3 pulsolectura.py entrar`
4. Cerrá y abrí Claude. Preguntá, por ejemplo: «¿quién tiene tareas atrasadas hoy en PulsoMOVE?»

El acceso dura 30 días; después repetís el paso 3. Si cambia tu PIN o te quitan el permiso, deja de funcionar al momento.
