/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   REGLAS DE SEGURIDAD QUE NO PUEDEN VIVIR EN LAS REGLAS DE ACCESO
   ------------------------------------------------------------
   Las reglas de PocketBase deciden QUIÉN puede escribir, pero no
   impiden QUÉ campos manda. Sin lo de abajo, cualquiera podía
   registrarse enviando rol = "admin" y quedar con acceso a todos los
   datos personales de los emprendedores. Probado: pasaba de verdad.
   ============================================================ */

/* 1. El rol nunca lo elige quien se registra.
      Toda cuenta creada desde el sitio nace como emprendedor; los
      administradores se marcan a mano desde el panel de PocketBase. */
onRecordCreateRequest(function (e) {
  var esSuperusuario = e.auth && e.auth.collection &&
                       e.auth.collection().name === '_superusers';
  if (!esSuperusuario) {
    e.record.set('rol', 'emprendedor');
  }
  e.next();
}, 'users');

/* 2. Tampoco puede ascenderse después editando su propia cuenta. */
onRecordUpdateRequest(function (e) {
  var esSuperusuario = e.auth && e.auth.collection &&
                       e.auth.collection().name === '_superusers';
  if (!esSuperusuario) {
    var original = e.app.findRecordById('users', e.record.id);
    e.record.set('rol', original.get('rol'));
  }
  e.next();
}, 'users');

/* 3. El estado de la ficha lo decide EquipoUni, no el emprendedor.
      Él puede editar sus datos, pero no declararse "validada" solo.
      Además, al tocar una ficha ya validada, vuelve a revisión: es la
      regla que promete la especificación. */
onRecordUpdateRequest(function (e) {
  var esAdmin = e.auth && e.auth.get && e.auth.get('rol') === 'admin';
  var esSuperusuario = e.auth && e.auth.collection &&
                       e.auth.collection().name === '_superusers';
  if (esAdmin || esSuperusuario) { e.next(); return; }

  var original = e.app.findRecordById('fichas', e.record.id);
  var estadoAntes = original.get('estado');

  if (estadoAntes === 'validada' || estadoAntes === 'correccion') {
    /* Cambió algo de una ficha ya revisada: vuelve a la cola. */
    e.record.set('estado', 'pendiente');
  } else {
    e.record.set('estado', estadoAntes);
  }
  /* Las observaciones son del revisor: el emprendedor no las borra. */
  e.record.set('observaciones', original.get('observaciones'));
  e.next();
}, 'fichas');

/* 4. Una postulación nace siempre en "postulado", con su historial
      abierto y la fecha del servidor, no la que mande el navegador. */
onRecordCreateRequest(function (e) {
  var hoy = new Date().toISOString().slice(0, 10);
  e.record.set('estado', 'postulado');
  e.record.set('estado_anterior', '');
  e.record.set('fecha', hoy);
  e.record.set('historial', [{ fecha: hoy, a: 'postulado' }]);
  e.next();
}, 'postulaciones');

/* 5. Los cambios de estado de una postulación respetan las transiciones
      de la especificación, y "renuncio" guarda de dónde venía. */
var TRANSICIONES = {
  postulado:    ['seleccionado', 'renuncio'],
  seleccionado: ['confirmado', 'renuncio'],
  confirmado:   ['renuncio'],
  renuncio:     []
};

onRecordUpdateRequest(function (e) {
  var original = e.app.findRecordById('postulaciones', e.record.id);
  var antes = original.get('estado');
  var despues = e.record.get('estado');

  if (antes !== despues) {
    var permitidas = TRANSICIONES[antes] || [];
    if (permitidas.indexOf(despues) === -1) {
      throw new BadRequestError('No se puede pasar de "' + antes + '" a "' + despues + '".');
    }
    var hoy = new Date().toISOString().slice(0, 10);
    var historial = original.get('historial') || [];
    var paso = { fecha: hoy, a: despues };
    if (despues === 'renuncio') {
      paso.desde = antes;
      e.record.set('estado_anterior', antes);
    }
    historial.push(paso);
    e.record.set('historial', historial);
  }
  e.next();
}, 'postulaciones');

/* 6. No se postula fuera de plazo, aunque la oportunidad siga publicada.
      La regla de acceso ya exige que esté publicada; el plazo se revisa
      acá porque es una comparación de fechas. */
onRecordCreateRequest(function (e) {
  var oportunidad = e.app.findRecordById('oportunidades', e.record.get('oportunidad'));
  var cierre = oportunidad.get('cierre_postulacion');
  var hoy = new Date().toISOString().slice(0, 10);
  if (cierre && cierre < hoy) {
    throw new BadRequestError('Esta oportunidad cerró sus postulaciones el ' + cierre + '.');
  }
  e.next();
}, 'postulaciones');
