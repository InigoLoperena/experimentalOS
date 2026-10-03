# Comprobación tras configurar Supabase

Esta comprobación valida los servicios reales que no estaban disponibles durante la construcción:

1. Registra dos cuentas con correos que controles y confirma ambos emails.
2. Con la primera crea Empresa A; con la segunda crea Empresa B. Comprueba que no ven datos de la otra empresa.
3. Desde A crea una North Star, un Goal, una Oportunidad, una Idea y un Experimento.
4. Invita la segunda cuenta a A como lector. Comprueba que ve A, pero no puede crear o editar. Empresa B permanece privada.
5. Intenta reutilizar la invitación desde una tercera cuenta: debe rechazarse.
6. Cambia la segunda cuenta a editor y guarda un cambio. En Actividad debe figurar su identidad.
7. Abre la misma ficha en dos sesiones. Guarda en una y después intenta guardar la versión antigua en la otra: debe aparecer el conflicto; actualiza y vuelve a editar.
8. Intenta lanzar un experimento sin hipótesis o criterio de éxito: debe rechazarse. Comprueba también que el reparto de variantes suma 100%.
9. Intenta cerrar sin resultado o aprendizaje: debe rechazarse.
10. Retira el acceso de la segunda cuenta desde Equipo. Tras actualizar, no debe poder leer A, aunque seguirá usando B.
11. Prueba recuperación de contraseña con el dominio Vercel configurado y comprueba que abre el formulario de nueva contraseña.
12. Reinicia sesión y confirma que los registros siguen presentes. El modo demostración debe indicar claramente que sus datos son ficticios.
