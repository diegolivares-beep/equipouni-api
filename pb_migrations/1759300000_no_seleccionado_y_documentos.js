/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   DOS ARREGLOS QUE TOCAN EL ESQUEMA
   ------------------------------------------------------------
   1. Falta el estado "no seleccionado" en las postulaciones.

      Hasta ahora "postulado" significaba dos cosas a la vez: todavía
      estamos decidiendo, y no quedaste. Con un solo estado para las
      dos, no hay a quién avisarle cuando cierra una selección, porque
      no se puede distinguir a quién ya se le dijo que no.

   2. Los documentos de formalización pasan a protegidos.

      Traen patente, resolución sanitaria e inicio de actividades: son
      los papeles más sensibles que sube una persona. Estaban
      accesibles por URL sin sesión, mientras la pantalla promete que
      los ve solo el equipo. Protegido significa que PocketBase exige
      un permiso de un solo uso para entregarlos.

      Las fotos de productos se dejan públicas a propósito: son
      material comercial, se muestran en el panel y en el documento que
      va a la productora, y protegerlas obligaría a pedir un permiso
      por cada miniatura sin ganar nada.
   ============================================================ */

migrate(function (app) {

  var post = app.findCollectionByNameOrId('postulaciones');
  var estado = post.fields.getByName('estado');
  estado.values = ['postulado', 'seleccionado', 'no_seleccionado', 'confirmado', 'renuncio'];
  app.save(post);

  var fichas = app.findCollectionByNameOrId('fichas');
  var docs = fichas.fields.getByName('documentos');
  if (docs) {
    docs.protected = true;
    app.save(fichas);
  }

}, function (app) {
  var post = app.findCollectionByNameOrId('postulaciones');
  /* Antes de sacar el estado hay que vaciarlo, o quedan filas con un
     valor que el esquema ya no acepta. */
  app.db().newQuery(
    "UPDATE postulaciones SET estado = 'postulado' WHERE estado = 'no_seleccionado'"
  ).execute();
  var estado = post.fields.getByName('estado');
  estado.values = ['postulado', 'seleccionado', 'confirmado', 'renuncio'];
  app.save(post);

  var fichas = app.findCollectionByNameOrId('fichas');
  var docs = fichas.fields.getByName('documentos');
  if (docs) {
    docs.protected = false;
    app.save(fichas);
  }
});
