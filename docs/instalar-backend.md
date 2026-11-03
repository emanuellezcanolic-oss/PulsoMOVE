# Instalar el backend de PulsoMOVE (una sola vez)

Lleva unos 10 minutos y se hace todo desde el navegador, con la cuenta de Google de MOVE.

## 1. Crear el proyecto

1. Entrá a <https://script.google.com> y tocá **Nuevo proyecto**.
2. Arriba a la izquierda, cambiá el nombre "Proyecto sin título" por **PulsoMOVE**.
3. En el engranaje **Configuración del proyecto**:
   - **Zona horaria:** `(GMT-03:00) Buenos Aires`.
   - Tildá **Mostrar el archivo de manifiesto "appsscript.json" en el editor**.

## 2. Pegar el código

En el panel **Archivos** (a la izquierda):

1. Abrí `Código.gs`, borrá todo y pegá el contenido de `apps-script/Logica.js`. Renombralo como **Logica** (tres puntitos → Cambiar nombre).
2. Con el **+** → **Secuencia de comandos**, creá **Api** y pegá `apps-script/Api.js`.
3. Lo mismo para **Hojas**, con `apps-script/Hojas.js`.
4. Abrí `appsscript.json`, borrá todo y pegá `apps-script/appsscript.json`.
5. Guardá (ícono del disquete o Ctrl+S).

El orden de los archivos en el panel tiene que ser **Logica, Api, Hojas**.

## 3. Crear la planilla y las claves

1. Arriba, en el desplegable de funciones, elegí **instalar** y tocá **Ejecutar**.
2. Google te pide permisos: **Revisar permisos** → elegí tu cuenta → **Configuración avanzada** → **Ir a PulsoMOVE (no seguro)** → **Permitir**.
   Dice "no seguro" porque el script es tuyo y no está verificado por Google. Es lo normal.
3. Abajo aparece "Listo. Planilla: https://…". Esa es la planilla privada: no la compartas con nadie.

## 4. Publicar la aplicación web

1. Arriba a la derecha: **Implementar** → **Nueva implementación**.
2. En el engranaje, elegí **Aplicación web**.
3. Completá:
   - **Descripción:** `PulsoMOVE v1`
   - **Ejecutar como:** `Yo`
   - **Quién tiene acceso:** `Cualquier usuario`
4. **Implementar**. Copiá la **URL de la aplicación web** (termina en `/exec`).

"Cualquier usuario" hace falta para que la app abra sin pedir una cuenta de Google. Los datos igual están protegidos: sin DNI y PIN correctos, la app no devuelve nada.

## 5. Guardar la URL y la clave en esta computadora

1. En el desplegable de funciones elegí **mostrarClaveCarga** y tocá **Ejecutar**. Abajo aparece una clave larga.
2. En la carpeta `C:\Users\Usuario\.move\` creá dos archivos de texto:
   - `pulso_url.txt`, con la URL del paso 4.
   - `pulso_clave.txt`, con la clave que acabás de ver.
3. Cerrá el registro de ejecución. **No pegues la clave en ningún chat, mail ni mensaje.**

## Si cambia el código

Después de pegar una versión nueva: **Implementar** → **Gestionar implementaciones** → lápiz → **Versión: Nueva versión** → **Implementar**. Así la URL no cambia.
