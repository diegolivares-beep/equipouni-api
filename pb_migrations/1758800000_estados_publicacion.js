/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   ESTADOS DE PUBLICACIÓN DE UNA OPORTUNIDAD
   ------------------------------------------------------------
   Pedido del cliente (WhatsApp, 24-sep): al administrar una
   oportunidad debe poder dejarla en borrador, oculta, programada o
   publicada, con botones para cada cosa al momento de crearla.

   Cómo queda:
     borrador    se está armando, no la ve nadie
     oculta      estaba lista y se bajó del sitio a propósito
     programada  se publica sola en la fecha indicada
     publicada   visible en el tablero
     cancelada   se suspendió; sigue visible para avisarle a la gente

   "Cerrada" ya no es un estado que alguien marque: se deduce de la
   fecha de cierre de postulaciones. Una oportunidad publicada cuyo
   plazo venció se muestra como cerrada sola, sin que nadie la toque.
   Así el cliente maneja los cuatro estados que pidió y no hay que
   acordarse de ir cerrando a mano cada convocatoria que pasa.
   ============================================================ */

migrate(function (app) {
  var c = app.findCollectionByNameOrId('oportunidades');

  var estado = c.fields.getByName('estado');
  estado.values = ['borrador', 'oculta', 'programada', 'publicada', 'cancelada'];

  /* Cuándo debe salir al aire una oportunidad programada.
     Formato AAAA-MM-DD, igual que el resto de las fechas del proyecto. */
  c.fields.add(new Field({
    name: 'fecha_publicacion', type: 'text', max: 10
  }));

  /* Solo lo publicado o cancelado se ve sin cuenta. Las programadas
     quedan fuera hasta que el reloj las publique. */
  var publico = 'estado = "publicada" || estado = "cancelada"';
  c.listRule = publico + ' || @request.auth.rol = "admin"';
  c.viewRule = publico + ' || @request.auth.rol = "admin"';

  app.save(c);

  /* Las que estaban en "vista_previa" pasan a "oculta", y las que
     estaban "cerrada" vuelven a "publicada": su plazo vencido ya las
     muestra como cerradas. */
  app.db().newQuery("UPDATE oportunidades SET estado = 'oculta' WHERE estado = 'vista_previa'").execute();
  app.db().newQuery("UPDATE oportunidades SET estado = 'publicada' WHERE estado = 'cerrada'").execute();

}, function (app) {
  var c = app.findCollectionByNameOrId('oportunidades');
  var estado = c.fields.getByName('estado');
  estado.values = ['borrador', 'vista_previa', 'publicada', 'cerrada', 'cancelada'];
  var f = c.fields.getByName('fecha_publicacion');
  if (f) c.fields.removeById(f.id);
  app.save(c);
});
