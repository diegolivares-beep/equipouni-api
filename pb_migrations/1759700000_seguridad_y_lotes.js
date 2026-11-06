/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   SEGURIDAD BARATA, OCULTAS POR ENLACE Y CORREOS POR LOTE
   ------------------------------------------------------------
   Sale de la revisión del 6-nov (vault raw/equipouni-seguridad/) y de
   la reunión con el cliente del 2-nov. Lo que cambia el esquema:

   1. LAS OCULTAS SE PUEDEN ABRIR POR ENLACE.
      El cliente pidió el 29-sep un botón para copiar el enlace de una
      oportunidad oculta, con esta premisa textual: "aunque esté oculta
      en la página sigue activa y la pueden usar, pero no está visible no
      más". El botón se construyó el 30-sep, pero las reglas de acceso
      seguían ocultando la oportunidad a todo el que no fuera admin: el
      enlace daba 404 y el servidor rechazaba postular. Se comprobó el
      6-nov contra producción. Ahora "oculta" significa lo que el cliente
      quiere: no sale en el listado (la listRule no cambia), pero quien
      tiene el enlace la abre (viewRule) y puede postular (createRule).

   2. EL CORREO DEL EMPRENDEDOR SE VE EN EL PANEL.
      PocketBase esconde el campo email de todos menos del dueño cuando
      emailVisibility está en false, aunque la regla de acceso deje ver
      el registro. Por eso el panel mostraba "Nombre ()" y el PDF que se
      le manda a la productora salía sin correo. La regla de users sigue
      siendo "uno mismo o admin", así que encenderlo no se lo muestra a
      nadie más. El hook 1 lo enciende al crear y el 2 impide apagarlo.

   3. MARCA DE LOS CORREOS POR LOTE (avisos_lote) y sus dos plantillas.
      Ver la ruta /api/eu/lote en avisos.pb.js.

   4. AJUSTES DE SEGURIDAD, versionados acá y no a mano en el panel:
      - rateLimits encendido. Las reglas ya existían, con los valores de
        fábrica de PocketBase, pero apagadas.
      - trustedProxy toma la IP de la DERECHA de X-Forwarded-For. La de
        la izquierda la puede escribir el propio visitante, y con ella se
        saltaba el límite inventando una IP distinta en cada intento.
        Detrás de un solo proxy (Traefik de Coolify) la de la derecha es
        siempre la que vio el proxy.
      - authAlert apagado en users. Manda un correo por cada inicio de
        sesión desde un navegador nuevo; como no hay verificación de
        correo, cualquiera se registra con el correo de un tercero y lo
        llena de avisos desde la casilla de la agencia. Para este sitio
        protege poco y se abusa fácil.
   ============================================================ */

migrate(function (app) {

  /* ---------- 1. ocultas por enlace ---------- */
  var op = app.findCollectionByNameOrId('oportunidades');
  op.viewRule = 'estado = "publicada" || estado = "cancelada" || estado = "oculta" || @request.auth.rol = "admin"';
  app.save(op);

  var post = app.findCollectionByNameOrId('postulaciones');
  post.createRule = '@request.auth.id != "" && ficha.usuario = @request.auth.id && ' +
    'ficha.estado = "validada" && ' +
    '(oportunidad.estado = "publicada" || oportunidad.estado = "oculta")';
  if (!post.fields.getByName('avisos_lote')) {
    post.fields.add(new Field({ name: 'avisos_lote', type: 'json', maxSize: 2000 }));
  }
  app.save(post);

  /* ---------- 2. correo visible para el panel ---------- */
  var users = app.findCollectionByNameOrId('users');
  users.authAlert.enabled = false;
  app.save(users);

  var todos = app.findAllRecords('users');
  for (var i = 0; i < todos.length; i++) {
    if (!todos[i].getBool('emailVisibility')) {
      todos[i].set('emailVisibility', true);
      app.save(todos[i]);
    }
  }

  /* ---------- 3. plantillas de los correos por lote ----------
     Son textos de partida, editables en el panel como los demás. */
  var PLANTILLAS = [
    {
      clave: 'lote_confirmado',
      asunto: 'Tu participación en {oportunidad} está confirmada',
      cuerpo:
        'Hola {nombre},\n\n' +
        'Recibimos y validamos tu pago. El cupo de {emprendimiento} en {oportunidad} ' +
        'está confirmado.\n\n' +
        'Cuándo: {fechas}\n' +
        'Dónde: {lugar}\n' +
        'Horario: {horario}\n' +
        '{asistencia}\n\n' +
        'Cualquier duda, responde este correo.\n\n' +
        'Equipo de EquipoUni'
    },
    {
      clave: 'lote_resultado',
      asunto: 'Resultado de tu postulación a {oportunidad}',
      cuerpo:
        'Hola {nombre},\n\n' +
        'El proceso de selección de {oportunidad} cerró y esta vez {emprendimiento} ' +
        'no quedó con cupo.\n\n' +
        'Tu ficha queda vigente para las próximas oportunidades, y si se libera un cupo ' +
        'y aceptaste que te contactemos, te vamos a escribir.\n\n' +
        'Puedes ver otras oportunidades en {sitio}\n\n' +
        'Equipo de EquipoUni'
    }
  ];
  var pl = app.findCollectionByNameOrId('plantillas_correo');
  PLANTILLAS.forEach(function (p) {
    var ya = app.findRecordsByFilter('plantillas_correo', 'clave = {:c}', '', 1, 0, { c: p.clave });
    if (ya.length) return;
    var r = new Record(pl);
    r.set('clave', p.clave);
    r.set('asunto', p.asunto);
    r.set('cuerpo', p.cuerpo);
    r.set('activa', true);
    app.save(r);
  });

  /* El texto de partida del aviso de suspensión (12-oct) salió sin tildes.
     Se corrige solo si sigue siendo ese texto: si el cliente ya lo editó,
     se respeta. */
  var cancel = app.findRecordsByFilter('plantillas_correo', 'clave = "oportunidad_cancelada"', '', 1, 0);
  if (cancel.length && String(cancel[0].get('asunto')) === 'Se suspendio: {oportunidad}') {
    cancel[0].set('asunto', 'Se suspendió: {oportunidad}');
    cancel[0].set('cuerpo',
      'Hola {nombre},\n\n' +
      'Te escribimos para avisarte que {oportunidad} se suspendió, así que ' +
      'tu participación con {emprendimiento} no sigue adelante.\n\n' +
      '{motivo}\n\n' +
      'Si alcanzaste a pagar tu participación, escríbenos respondiendo este ' +
      'correo y lo resolvemos contigo.\n\n' +
      'Puedes ver otras oportunidades abiertas en {sitio}\n\n' +
      'Equipo de EquipoUni');
    app.save(cancel[0]);
  }

  /* ---------- 4. ajustes de seguridad ---------- */
  var s = app.settings();
  s.rateLimits.enabled = true;
  s.trustedProxy.useLeftmostIP = false;
  app.save(s);

}, function (app) {

  var op = app.findCollectionByNameOrId('oportunidades');
  op.viewRule = 'estado = "publicada" || estado = "cancelada" || @request.auth.rol = "admin"';
  app.save(op);

  var post = app.findCollectionByNameOrId('postulaciones');
  post.createRule = '@request.auth.id != "" && ficha.usuario = @request.auth.id && ' +
    'ficha.estado = "validada" && oportunidad.estado = "publicada"';
  if (post.fields.getByName('avisos_lote')) post.fields.removeByName('avisos_lote');
  app.save(post);

  var users = app.findCollectionByNameOrId('users');
  users.authAlert.enabled = true;
  app.save(users);

  ['lote_confirmado', 'lote_resultado'].forEach(function (clave) {
    try {
      var r = app.findRecordsByFilter('plantillas_correo', 'clave = {:c}', '', 1, 0, { c: clave });
      if (r.length) app.delete(r[0]);
    } catch (e) { /* ya no está */ }
  });

  var s = app.settings();
  s.rateLimits.enabled = false;
  s.trustedProxy.useLeftmostIP = true;
  app.save(s);
});
