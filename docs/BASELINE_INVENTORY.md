# Baseline de WIS BOTS

## Repositorio raíz

El repositorio raíz administra:

- contratos e instrucciones multiagente;
- scripts LinkedIn ubicados en la raíz;
- paquete autocontenido `wis_x`;
- documentación e incidentes asociados.

Los scripts LinkedIn no se mueven en la fase inicial porque interactúan con workflows vivos y varios dependen de configuración externa. Su reorganización requiere una tarea separada con pruebas de regresión.

## Repositorios independientes

- `wis-agency`: repositorio de web con historial propio. Al crear el baseline tenía un archivo local no versionado en `frontend/public/wis-premium-preview.html`; se preservó sin modificar. `frontend/src/**` se define como frontend canónico y `frontend/wis-frontend/**` como copia histórica no editable.
- `chattermate.chat`: repositorio externo/de referencia con cambios locales del usuario; queda excluido del baseline raíz.
- `design-lab`: colección de repositorios de referencia; excluida.
- `pgvector-0.8.6`: repositorio upstream; excluido.

## Artefactos excluidos

Entornos virtuales, dependencias, caches, reportes, capturas, archivos temporales, estados de navegador y configuración secreta se excluyen mediante `.gitignore`.

## Estado de seguridad

- X conserva dry-run y sus flags de producción apagados.
- LinkedIn conserva sus flags de sistema y publicación apagados.
- Las pruebas LinkedIn live/controladas se clasifican como side-effectful.
- Ninguna credencial ni contenido secreto debe formar parte del commit baseline.
