# Backend de PulsoMOVE: cómo se instala y se actualiza

El código de `apps-script/` se sube a Google con [clasp](https://github.com/google/clasp) desde la computadora del pipeline.

## Una sola vez (dueño de la cuenta)

1. Activar la API en <https://script.google.com/home/usersettings>.
2. `npx @google/clasp@3.4.1 login` y aceptar en el navegador.
3. `npx @google/clasp@3.4.1 create-script --type standalone --title PulsoMOVE --rootDir apps-script`
   (deja `.clasp.json`, que no se sube al repo; volver a poner `apps-script/appsscript.json` como está en el repo).
4. `npx @google/clasp@3.4.1 push --force` y `npx @google/clasp@3.4.1 create-deployment --description "PulsoMOVE v1"`.
5. Guardar la URL `https://script.google.com/macros/s/<id>/exec` en `%USERPROFILE%\.move\pulso_url.txt`.
6. En el editor de Apps Script, ejecutar `instalar` una vez y autorizar los permisos (crea la planilla privada).
7. Generar la clave de carga en `%USERPROFILE%\.move\pulso_clave.txt` (64 caracteres hex) y mandarla una sola vez
   con la acción `iniciar_clave`. Después la web ya no permite cambiarla.

## Cada vez que cambia el código

```bash
npx @google/clasp@3.4.1 push --force
npx @google/clasp@3.4.1 update-deployment <id> --description "PulsoMOVE vN"
```

Así la URL no cambia.
