# Despliegue del front

Next.js 16 + NextAuth. Despliega bien en Vercel (plan Hobby incluido), porque
todo lo pesado ocurre en el worker.

## Variables de entorno

| Variable | Valor |
|---|---|
| `NEXTAUTH_URL` | El dominio de producción, sin barra final: `https://napsis-front.vercel.app` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` (uno distinto del de local) |
| `GOOGLE_CLIENT_ID` | Del cliente OAuth de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Del mismo cliente |
| `WORKER_URL` | URL pública del worker, sin barra final |
| `WORKER_API_KEY` | Debe coincidir **exactamente** con `API_KEY` del worker |
| `NEXT_PUBLIC_DEFAULT_COLEGIO` | Slug del colegio que aparece por defecto |
| `ALLOWED_EMAIL_DOMAINS` | Opcional: restringe el acceso a esos dominios, separados por coma |

### `NEXTAUTH_URL` no puede quedar vacía

Si la variable **existe pero sin valor**, el build falla al prerenderizar `/`:

```
TypeError: Invalid URL
  code: 'ERR_INVALID_URL', input: ''
```

NextAuth hace `new URL(process.env.NEXTAUTH_URL)` al evaluar el módulo. Si la
variable no existe usa un valor por defecto; si existe vacía, revienta. O le
pones el dominio, o la borras.

Tampoco conviene dejarla sin definir: NextAuth caería entonces en `VERCEL_URL`,
que es la URL única de cada despliegue y cambia en cada push, así que Google
rechazaría el login con `redirect_uri_mismatch`.

## Google Cloud Console

En el cliente OAuth, **URI de redireccionamiento autorizados**, hay que añadir
uno por cada entorno:

```
http://localhost:3000/api/auth/callback/google
https://<dominio-de-produccion>/api/auth/callback/google
```

Los despliegues de preview de Vercel tienen URLs aleatorias que no están
registradas, así que el login solo funciona en producción y en local.

El scope necesario es `https://www.googleapis.com/auth/gmail.compose`. Mientras
la app esté en modo *Prueba*, el refresh token caduca a los 7 días y hay que
volver a iniciar sesión; para uso continuado hay que publicarla, lo que con ese
scope implica verificación de Google.

## El proceso dura más que una función de Vercel

El proxy de `/api/worker` tiene `maxDuration = 300`, que es el techo del plan
Hobby. Un curso completo tarda más, así que Vercel cortará el SSE a mitad. No es
un problema: `useJobEvents` lo detecta, pide un snapshot del proceso y se
reconecta sola.

## El worker

Va aparte, y no cabe en los planes gratuitos: necesita ≥ 1 GB de RAM y estar
siempre encendido. Los detalles están en el `DEPLOY.md` de `napsis-worker`.
