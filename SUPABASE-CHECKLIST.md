# Comprobación después de actualizar Supabase

1. Ejecuta `002_project_growth_tree.sql` sobre la instalación existente. No repitas `001_initial.sql`.
2. Desactiva Confirm email y registra una cuenta nueva: debe entrar automáticamente. Recarga y comprueba que conserva la sesión; cierra sesión y entra con email y contraseña. Un email ya registrado debe producir un error al intentar registrarlo otra vez.
3. Comprueba las seis secciones del menú: Experimentos, Proyectos, Aprendizajes, Equipo, Growth Tree y Cómo utilizar Experimental OS.
4. Crea Proyecto A y Proyecto B dentro de una misma empresa. Cada uno debe permitir su propia North Star.
5. En A crea Goal, sub-Goal, oportunidad e idea. Crea varios experimentos desde esa idea.
6. Cambia el selector a B en Experimentos y Growth Tree: no deben aparecer los registros de A. Vuelve a A y comprueba que siguen allí.
7. Destaca cinco oportunidades en cada proyecto. Una sexta debe rechazarse en ese proyecto, sin afectar al otro.
8. La ficha de experimento solo debe mostrar los campos acordados; no debe mostrar Proyecto, Idea, estados, variantes, resultados o analista.
9. Abre un experimento y documenta un aprendizaje. Debe aparecer en Aprendizajes de su proyecto y conservar la referencia al experimento.
10. Invita otra cuenta como lector: debe poder leer, pero no guardar. Cambia su rol a editor y comprueba que la identidad del autor figura en la ficha.
11. Edita la misma ficha en dos sesiones: la versión antigua debe mostrar un conflicto al guardar.
12. Retira el acceso de un miembro: no debe seguir leyendo la empresa. Comprueba que el historial conserva su identidad.
13. Prueba recuperar una contraseña con el dominio Vercel autorizado. Este flujo sigue utilizando email.
