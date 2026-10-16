# Desde ChatGPT: ficha y borrador de campaña

`prepare_campaign_experiment` amplía la conexión MCP de Xperiments; no necesita
que Google Ads, Meta Ads o Smartlead tengan otro conector en ChatGPT. El backend
utiliza las conexiones privadas ya guardadas en Integraciones.

## Recorrido y estados

1. El chat envía la ficha y `campaign: {provider, plan}`. El servidor valida
   el plan nativo existente y exactamente dos variantes, lo cifra y devuelve un
   enlace de 30 minutos con `saved=false`, `campaign_saved=false`.
2. La web autenticada muestra ficha, configuración y variantes. El usuario
   elige un proyecto donde tenga `experiments.create` y `experiments.edit`.
   Google requiere confirmar que no es publicidad política de la UE.
3. Al guardar se usa `save_experiment_preparation`: registro, especificación de
   presupuesto y variantes se escriben atómicamente con el JWT y RLS existentes.
   El Responsable y el espacio salen de la cuenta/proyecto comprobados.
4. En esa misma página se muestran los componentes nativos de revisión/envío.
   Google hace validateOnly antes de crear; Meta conserva un recibo por paso;
   Smartlead comprueba el borrador y ambas variantes. Se requiere el mismo
   consentimiento que en la app; no se omite ni autoacepta.
5. Los RPCs nativos `finish_google_ads`, `finish_meta_step` y `finish_smartlead`
   guardan los recursos vinculados para el seguimiento existente. La página
   consulta esos vínculos bajo el mismo usuario y muestra los IDs.

## Alcance real

- Google: campañas SEARCH y DISPLAY con dos anuncios, pausados. Display
  requiere materiales y recortes. Google puede optimizar la rotación: no es
  un experimento aleatorio 50/50 ni un experimento nativo de Google Ads.
- Meta: preparación actual de Facebook/Instagram, materiales, selección y
  confirmación. Recursos pausados. No equivale a un test A/B nativo de Meta.
- Smartlead: una campaña en borrador con dos variantes 50/50 del primer correo.
  Sin listas de destinatarios, remitentes, envío ni activación automática.
- PostHog: esta ampliación no cambia código, feature flags ni experimentos
  creados desde otros conectores. Su integración nativa previa sigue separada.

No hay OAuth/delegación permanente al chat. La confirmación sucede en la web;
por tanto NO se debe anunciar que se crea todo exclusivamente desde el chat.
Para ese requisito futuro hará falta autenticación delegada y herramientas
de escritura por cuenta. No existe transacción distribuida con el proveedor:
si falla, la ficha se conserva. Los estados pendientes/inciertos no se reenvían
a ciegas. No pedir a otro conector que cree de nuevo lo que ya se envió aquí.

## Uso de Smartlead

El administrador guarda la API key en Integraciones → Smartlead del espacio
de trabajo, nunca en ChatGPT. Luego el usuario pide la ficha y dos correos,
abre el enlace de revisión, guarda y confirma «crear borrador» en esta página.
No hace falta un conector de Smartlead independiente: el MCP llama al backend,
y el backend a `https://server.smartlead.ai/api/v1`.
Los permisos y disponibilidad de la API dependen de la cuenta del proveedor.

## Datos y validación

No se admiten claves, IDs de cuenta ni propiedades ajenas al plan. No se
recuperan imágenes desde URLs aportadas por el modelo; se adjuntan mediante
el almacenamiento privado de la ficha. Se conserva el tope agregado UTF-8 y
el cifrado/vencimiento anterior. La edición pública conserva únicamente los
tres libros y metodología general, sin los proyectos del creador.

Pruebas: DTO, cifrado, rechazo de credenciales, separación de proveedores,
RPC atómico de variantes, permisos, reintentos y herramientas públicas sin
llamadas a proveedores. También se ejecutan las pruebas nativas existentes
de creación pausada y guardado de IDs, incluidas respuestas inciertas y fallos
parciales. Esas pruebas usan proveedores simulados; no deben presentarse como
creación real en las cuentas externas.

Referencias oficiales:
- https://developers.google.com/google-ads/api/docs/campaigns/create-campaigns
- https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/
- https://api.smartlead.ai/guides/campaign-setup
- https://api.smartlead.ai/core/sequences
