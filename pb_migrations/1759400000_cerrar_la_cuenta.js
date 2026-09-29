/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   DERECHO A CERRAR LA CUENTA
   ------------------------------------------------------------
   Hasta ahora sólo un administrador podía borrar un usuario, y ninguna
   pantalla ofrecía la acción: quien quisiera irse de la plataforma no
   tenía ninguna vía. La Ley 21.719 rige desde el 1 de diciembre de
   2026 y el derecho de supresión es uno de los que reconoce.

   Se permite que cada persona borre SU cuenta. Lo que se lleva consigo
   está definido en el esquema inicial: la ficha borra en cascada con el
   usuario, y las postulaciones con la ficha. O sea, cerrar la cuenta
   borra de verdad, no esconde.

   El hook que acompaña esta migración impide cerrarla cuando hay un
   compromiso en curso (seleccionado o confirmado en un evento que
   todavía no pasa), porque ahí hay un tercero esperando y una
   obligación que cumplir. En ese caso se pide escribirle a EquipoUni.
   ============================================================ */

migrate(function (app) {
  var users = app.findCollectionByNameOrId('users');
  users.deleteRule = 'id = @request.auth.id || @request.auth.rol = "admin"';

  /* Cuándo aceptó el tratamiento de datos y qué versión de los textos
     regía ese día. La casilla del formulario se marcaba y no quedaba
     registrada en ninguna parte: sin esto no hay forma de demostrar que
     se pidió el consentimiento, que es justo lo que exige la ley. */
  if (!users.fields.getByName('acepto_datos')) {
    users.fields.add(new Field({
      name: 'acepto_datos', type: 'text', max: 40
    }));
  }
  app.save(users);

  /* La cuenta que ya existía aceptó en el formulario del sitio, antes de
     que se guardara: se deja constancia de que fue antes de esta fecha. */
  app.db().newQuery(
    "UPDATE users SET acepto_datos = 'anterior a 2026-09-29' " +
    "WHERE acepto_datos IS NULL OR acepto_datos = ''"
  ).execute();

}, function (app) {
  var users = app.findCollectionByNameOrId('users');
  users.deleteRule = '@request.auth.rol = "admin"';
  var f = users.fields.getByName('acepto_datos');
  if (f) users.fields.removeById(f.id);
  app.save(users);
});
