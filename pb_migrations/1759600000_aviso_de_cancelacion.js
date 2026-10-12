/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   AVISARLE A QUIEN POSTULO CUANDO EL EVENTO SE SUSPENDE
   ------------------------------------------------------------
   Lo encontro el cruce del mapa de procesos del 12-oct, y es un
   agujero nuestro, no un pedido nuevo del cliente.

   El estado "cancelada" lo agregamos NOSOTROS el 24-sep, y el
   argumento con el que se agrego esta escrito en config/estados.js:
   "Se suspendio. Sigue visible para avisarle a quien postulo". El
   estado se puede poner desde el panel, el sitio publico lo muestra
   bien, y el aviso nunca se construyo: las plantillas de correo eran
   tres y ninguna era esta. O sea el emprendedor se enteraba llegando
   a una feria suspendida.

   Lo que agrega esta migracion:

   1. motivo_cancelacion en la oportunidad. Avisar "se suspendio" sin
      decir por que deja a la persona escribiendole a EquipoUni para
      preguntar lo mismo veinte veces. El campo es del equipo y viaja
      al correo y al detalle publico.

   2. aviso_cancelacion en la postulacion. Es la misma idea que
      aviso_estado: la marca de que a ESA persona ya se le aviso. Sin
      ella, cada vez que alguien guarde la oportunidad cancelada sale
      el correo de nuevo. No se reusa aviso_estado porque ese campo lo
      ocupa el aviso de seleccion y pisarlo haria que el correo de
      "quedaste seleccionado" se mande dos veces.

   3. ficha_copia en la postulacion. La productora recibe los datos
      que la ficha tiene HOY, no los que tenia al postular: si el
      emprendedor la edita despues, cambia lo que ya se envio y no
      queda rastro de lo que se evaluo. Esto guarda, al momento de
      postular, copia de los campos que efectivamente viajan en la
      exportacion. El RUT NO va, igual que no va en la exportacion.
      No se rellena hacia atras: las postulaciones viejas quedan sin
      copia, que es la verdad, en vez de inventarles una con los datos
      de hoy.

   4. La cuarta plantilla de correo, editable desde el panel como las
      otras tres.

   Nada retroactivo: si al correr esto hubiera una oportunidad ya
   cancelada, sus postulaciones quedan marcadas como avisadas. Mandar
   hoy un correo por un evento que se suspendio hace semanas es peor
   que no mandarlo. Es la misma precaucion que se tomo el 30-sep con
   los otros tres avisos.
   ============================================================ */

migrate(function (app) {

  /* ---------- 1. el motivo, en la oportunidad ---------- */
  var op = app.findCollectionByNameOrId('oportunidades');
  if (!op.fields.getByName('motivo_cancelacion')) {
    op.fields.add(new Field({ name: 'motivo_cancelacion', type: 'text', max: 300 }));
  }
  app.save(op);

  /* ---------- 2. las dos marcas, en la postulacion ---------- */
  var post = app.findCollectionByNameOrId('postulaciones');
  if (!post.fields.getByName('aviso_cancelacion')) {
    post.fields.add(new Field({ name: 'aviso_cancelacion', type: 'text', max: 40 }));
  }
  if (!post.fields.getByName('ficha_copia')) {
    post.fields.add(new Field({ name: 'ficha_copia', type: 'json', maxSize: 4000 }));
  }
  app.save(post);

  /* ---------- 3. la cuarta plantilla ----------
     El texto es un punto de partida, como los otros tres: el cliente
     los edita en el panel, en Comunicaciones. Las marcas entre llaves
     las reemplaza el hook. */
  var yaEsta = app.findRecordsByFilter(
    'plantillas_correo', 'clave = "oportunidad_cancelada"', '', 1, 0);
  if (!yaEsta.length) {
    var pl = app.findCollectionByNameOrId('plantillas_correo');
    var r = new Record(pl);
    r.set('clave', 'oportunidad_cancelada');
    r.set('asunto', 'Se suspendio: {oportunidad}');
    r.set('cuerpo',
      'Hola {nombre},\n\n' +
      'Te escribimos para avisarte que {oportunidad} se suspendio, asi que ' +
      'tu postulacion con {emprendimiento} no sigue adelante.\n\n' +
      '{motivo}\n\n' +
      'Si alcanzaste a pagar tu participacion, escribenos respondiendo este ' +
      'correo y lo resolvemos contigo.\n\n' +
      'Puedes ver otras oportunidades abiertas en {sitio}\n\n' +
      'Equipo de EquipoUni');
    r.set('activa', true);
    app.save(r);
  }

  /* ---------- 4. nada de correos retroactivos ---------- */
  var canceladas = app.findRecordsByFilter(
    'oportunidades', 'estado = "cancelada"', '', 0, 0);
  for (var i = 0; i < canceladas.length; i++) {
    var ps = app.findRecordsByFilter(
      'postulaciones', 'oportunidad = {:o}', '', 0, 0, { o: canceladas[i].id });
    for (var j = 0; j < ps.length; j++) {
      ps[j].set('aviso_cancelacion', 'anterior al aviso automatico');
      app.save(ps[j]);
    }
  }

}, function (app) {

  try {
    var vieja = app.findRecordsByFilter(
      'plantillas_correo', 'clave = "oportunidad_cancelada"', '', 1, 0);
    if (vieja.length) app.delete(vieja[0]);
  } catch (e) { /* ya no está */ }

  function quitar(coleccion, nombres) {
    var c = app.findCollectionByNameOrId(coleccion);
    nombres.forEach(function (n) {
      if (c.fields.getByName(n)) c.fields.removeByName(n);
    });
    app.save(c);
  }

  quitar('oportunidades', ['motivo_cancelacion']);
  quitar('postulaciones', ['aviso_cancelacion', 'ficha_copia']);
});
