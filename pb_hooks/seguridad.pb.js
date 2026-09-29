/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   REGLAS QUE NO PUEDEN VIVIR EN LAS REGLAS DE ACCESO
   ------------------------------------------------------------
   Las reglas de PocketBase deciden QUIÉN puede escribir, pero no
   QUÉ campos manda. Todo lo que dependa del contenido va acá.

   IMPORTANTE, se aprendió a la mala: cada hook corre en su propio
   contexto y NO ve las variables ni funciones declaradas fuera. Todo
   lo que un hook necesita va escrito dentro de él, aunque se repita.
   Tenerlo afuera hacía fallar los cambios de estado con un error
   genérico imposible de rastrear.
   ============================================================ */

/* 1. El rol nunca lo elige quien se registra.
      Toda cuenta creada desde el sitio nace como emprendedor; los
      administradores se marcan a mano desde el panel de PocketBase. */
onRecordCreateRequest(function (e) {
  var esSuperusuario = e.auth && e.auth.collection &&
                       e.auth.collection().name === '_superusers';
  if (!esSuperusuario) {
    e.record.set('rol', 'emprendedor');
    /* Queda registrado cuándo aceptó el tratamiento de datos. Lo pone el
       servidor y no el formulario: la casilla del navegador se puede
       saltar mandando la petición directo, la fecha del servidor no. */
    e.record.set('acepto_datos', new Date().toISOString().slice(0, 10));
  }
  e.next();
}, 'users');

/* 2. Tampoco puede ascenderse después editando su propia cuenta. */
onRecordUpdateRequest(function (e) {
  var esSuperusuario = e.auth && e.auth.collection &&
                       e.auth.collection().name === '_superusers';
  if (!esSuperusuario) {
    var original = $app.findRecordById('users', e.record.id);
    e.record.set('rol', original.get('rol'));
  }
  e.next();
}, 'users');

/* 3. Una ficha nace SIEMPRE pendiente de revisión.
      Sin esto, quien se registra puede mandar estado = "validada" en la
      creación y postular sin que nadie lo revise: las reglas de acceso
      no miran campos y el hook de edición (el 4) no corre al crear.
      Es el mismo agujero que el del rol, en otra colección. */
onRecordCreateRequest(function (e) {
  var esAdmin = e.auth && e.auth.get && e.auth.get('rol') === 'admin';
  var esSuperusuario = e.auth && e.auth.collection &&
                       e.auth.collection().name === '_superusers';
  if (!esAdmin && !esSuperusuario) {
    e.record.set('estado', 'pendiente');
    e.record.set('observaciones', {});
  }
  e.next();
}, 'fichas');

/* 4. El estado de la ficha lo decide EquipoUni, no el emprendedor.
      Él edita sus datos; al tocar una ficha ya revisada, vuelve a la
      cola, que es lo que promete la especificación. */
onRecordUpdateRequest(function (e) {
  var esAdmin = e.auth && e.auth.get && e.auth.get('rol') === 'admin';
  var esSuperusuario = e.auth && e.auth.collection &&
                       e.auth.collection().name === '_superusers';
  if (esAdmin || esSuperusuario) { e.next(); return; }

  var original = $app.findRecordById('fichas', e.record.id);
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

/* 5. Una postulación nace en "postulado", con la fecha del servidor en
      hora de Chile y su historial abierto. */
onRecordCreateRequest(function (e) {
  /* Chile cambia de huso dos veces al año y el contenedor corre en UTC.
     Sin esto, entre las 20:00 y la medianoche la fecha guardada es la
     del día siguiente. Horario de verano: del primer domingo de
     septiembre al primer domingo de abril. */
  function hoyEnChile() {
    var ahora = new Date();
    var a = ahora.getUTCFullYear();
    function primerDomingo(ano, mes) {
      var d = new Date(Date.UTC(ano, mes, 1));
      return new Date(Date.UTC(ano, mes, 1 + ((7 - d.getUTCDay()) % 7)));
    }
    var inicioVerano = primerDomingo(a, 8);   // septiembre
    var finVerano = primerDomingo(a, 3);      // abril
    var esVerano = ahora >= inicioVerano || ahora < finVerano;
    var desfase = esVerano ? 3 : 4;
    return new Date(ahora.getTime() - desfase * 3600 * 1000)
      .toISOString().slice(0, 10);
  }

  var hoy = hoyEnChile();
  var quien = (e.auth && e.auth.id) || '';
  e.record.set('estado', 'postulado');
  e.record.set('estado_anterior', '');
  e.record.set('fecha', hoy);
  e.record.set('historial', [{
    fecha: hoy,
    momento: new Date().toISOString(),
    a: 'postulado',
    por: quien
  }]);
  e.next();
}, 'postulaciones');

/* 6. Los cambios de estado respetan las transiciones de la
      especificación, quedan firmados y no pasan de los cupos. */
onRecordUpdateRequest(function (e) {
  var TRANSICIONES = {
    postulado:      ['seleccionado', 'no_seleccionado', 'renuncio'],
    seleccionado:   ['confirmado', 'renuncio'],
    confirmado:     ['renuncio'],
    no_seleccionado: ['seleccionado'],
    renuncio:       []
  };
  /* Los dos estados que ocupan un cupo de verdad. */
  var OCUPAN = ['seleccionado', 'confirmado'];

  /* Un campo JSON llega como los BYTES del texto, o sea un arreglo de
     números. Agregarle un elemento sin convertirlo corrompe el dato. */
  function comoLista(valor) {
    if (!valor) return [];
    if (Array.isArray(valor) && (valor.length === 0 || typeof valor[0] !== 'number')) {
      return valor;
    }
    try {
      var v = JSON.parse(valor);
      return Array.isArray(v) ? v : [];
    } catch (err) {
      try {
        var v2 = JSON.parse(String.fromCharCode.apply(null, valor));
        return Array.isArray(v2) ? v2 : [];
      } catch (err2) { return []; }
    }
  }

  function hoyEnChile() {
    var ahora = new Date();
    var a = ahora.getUTCFullYear();
    function primerDomingo(ano, mes) {
      var d = new Date(Date.UTC(ano, mes, 1));
      return new Date(Date.UTC(ano, mes, 1 + ((7 - d.getUTCDay()) % 7)));
    }
    var esVerano = ahora >= primerDomingo(a, 8) || ahora < primerDomingo(a, 3);
    return new Date(ahora.getTime() - (esVerano ? 3 : 4) * 3600 * 1000)
      .toISOString().slice(0, 10);
  }

  var original = $app.findRecordById('postulaciones', e.record.id);
  var antes = original.get('estado');
  var despues = e.record.get('estado');

  if (antes !== despues) {
    var permitidas = TRANSICIONES[antes] || [];
    if (permitidas.indexOf(despues) === -1) {
      throw new BadRequestError('No se puede pasar de "' + antes + '" a "' + despues + '".');
    }

    /* No se puede dar un cupo que no existe. Se cuenta contra la base,
       no contra el número guardado, porque ese número puede quedar
       viejo si algo se escribió por fuera. */
    if (OCUPAN.indexOf(despues) !== -1 && OCUPAN.indexOf(antes) === -1) {
      var oportunidad = $app.findRecordById('oportunidades', original.get('oportunidad'));
      var cupos = oportunidad.get('cupos') || 0;
      if (cupos > 0) {
        var ocupados = $app.findRecordsByFilter(
          'postulaciones',
          'oportunidad = {:o} && (estado = "seleccionado" || estado = "confirmado")',
          '', 0, 0, { o: original.get('oportunidad') }
        ).length;
        if (ocupados >= cupos) {
          throw new BadRequestError(
            'No quedan cupos: ' + oportunidad.get('nombre') + ' tiene ' + cupos +
            ' y ya están todos tomados.');
        }
      }
    }

    var historial = comoLista(original.get('historial'));
    var paso = {
      fecha: hoyEnChile(),
      momento: new Date().toISOString(),
      a: despues,
      por: (e.auth && e.auth.id) || ''
    };
    if (despues === 'renuncio') {
      paso.desde = antes;
      e.record.set('estado_anterior', antes);
    }
    historial.push(paso);
    e.record.set('historial', historial);
  }
  e.next();
}, 'postulaciones');

/* 7. No se postula fuera de plazo, aunque la oportunidad siga publicada.
      La regla de acceso ya exige que esté publicada; el plazo se revisa
      acá porque es una comparación de fechas, y con la fecha de Chile:
      con UTC, a las 21:00 del día del cierre el sitio dejaba postular y
      el backend rechazaba. */
onRecordCreateRequest(function (e) {
  function hoyEnChile() {
    var ahora = new Date();
    var a = ahora.getUTCFullYear();
    function primerDomingo(ano, mes) {
      var d = new Date(Date.UTC(ano, mes, 1));
      return new Date(Date.UTC(ano, mes, 1 + ((7 - d.getUTCDay()) % 7)));
    }
    var esVerano = ahora >= primerDomingo(a, 8) || ahora < primerDomingo(a, 3);
    return new Date(ahora.getTime() - (esVerano ? 3 : 4) * 3600 * 1000)
      .toISOString().slice(0, 10);
  }

  var oportunidad = $app.findRecordById('oportunidades', e.record.get('oportunidad'));
  var cierre = oportunidad.get('cierre_postulacion');
  if (cierre && cierre < hoyEnChile()) {
    throw new BadRequestError('Esta oportunidad cerró sus postulaciones el ' + cierre + '.');
  }
  e.next();
}, 'postulaciones');

/* 8. Los cupos disponibles se recalculan solos.
      Antes el número se escribía al crear la oportunidad y no lo tocaba
      nadie más: el sitio mostraba cupos que ya no existían. Ahora sale
      de contar las postulaciones que ocupan lugar, cada vez que una
      cambia.

      OJO: la cuenta va repetida dentro de cada hook a propósito, y no
      sacada a una función común. Sacarla afuera es exactamente lo que
      advierte el encabezado de este archivo: el hook no la ve, lanza un
      ReferenceError, y PocketBase lo devuelve como un 400 genérico
      imposible de rastrear. Pasó de nuevo el 29-sep y dejó postular
      completamente roto: repetir doce líneas es más barato que volver a
      perder una hora buscando esto. */

onRecordAfterCreateSuccess(function (e) {
  try {
    var id = e.record.get('oportunidad');
    if (id) {
      var o = $app.findRecordById('oportunidades', id);
      var n = $app.findRecordsByFilter('postulaciones',
        'oportunidad = {:o} && (estado = "seleccionado" || estado = "confirmado")',
        '', 0, 0, { o: id }).length;
      var q = (o.get('cupos') || 0) - n;
      o.set('cupos_disponibles', q > 0 ? q : 0);
      $app.save(o);
    }
  } catch (err) { console.log('cupos tras crear: ' + err); }
  e.next();
}, 'postulaciones');

onRecordAfterUpdateSuccess(function (e) {
  try {
    var id = e.record.get('oportunidad');
    if (id) {
      var o = $app.findRecordById('oportunidades', id);
      var n = $app.findRecordsByFilter('postulaciones',
        'oportunidad = {:o} && (estado = "seleccionado" || estado = "confirmado")',
        '', 0, 0, { o: id }).length;
      var q = (o.get('cupos') || 0) - n;
      o.set('cupos_disponibles', q > 0 ? q : 0);
      $app.save(o);
    }
  } catch (err) { console.log('cupos tras editar: ' + err); }
  e.next();
}, 'postulaciones');

onRecordAfterDeleteSuccess(function (e) {
  try {
    var id = e.record.get('oportunidad');
    if (id) {
      var o = $app.findRecordById('oportunidades', id);
      var n = $app.findRecordsByFilter('postulaciones',
        'oportunidad = {:o} && (estado = "seleccionado" || estado = "confirmado")',
        '', 0, 0, { o: id }).length;
      var q = (o.get('cupos') || 0) - n;
      o.set('cupos_disponibles', q > 0 ? q : 0);
      $app.save(o);
    }
  } catch (err) { console.log('cupos tras borrar: ' + err); }
  e.next();
}, 'postulaciones');

/* 9. Cerrar la cuenta borra de verdad, pero no deja a nadie plantado.
      Si la persona tiene un cupo tomado en un evento que todavía no
      ocurre, hay una productora contando con ella: primero se resuelve
      eso con EquipoUni y después se cierra. Fuera de ese caso, se borra
      la cuenta con su ficha, sus archivos y sus postulaciones. */
onRecordDeleteRequest(function (e) {
  var esAdmin = e.auth && e.auth.get && e.auth.get('rol') === 'admin';
  var esSuperusuario = e.auth && e.auth.collection &&
                       e.auth.collection().name === '_superusers';
  if (esAdmin || esSuperusuario) { e.next(); return; }

  function hoyEnChile() {
    var ahora = new Date();
    var a = ahora.getUTCFullYear();
    function primerDomingo(ano, mes) {
      var d = new Date(Date.UTC(ano, mes, 1));
      return new Date(Date.UTC(ano, mes, 1 + ((7 - d.getUTCDay()) % 7)));
    }
    var esVerano = ahora >= primerDomingo(a, 8) || ahora < primerDomingo(a, 3);
    return new Date(ahora.getTime() - (esVerano ? 3 : 4) * 3600 * 1000)
      .toISOString().slice(0, 10);
  }

  var fichas = $app.findRecordsByFilter(
    'fichas', 'usuario = {:u}', '', 0, 0, { u: e.record.id });
  if (!fichas.length) { e.next(); return; }

  var pendientes = $app.findRecordsByFilter(
    'postulaciones',
    'ficha = {:f} && (estado = "seleccionado" || estado = "confirmado")',
    '', 0, 0, { f: fichas[0].id }
  );

  var hoy = hoyEnChile();
  for (var i = 0; i < pendientes.length; i++) {
    var o = $app.findRecordById('oportunidades', pendientes[i].get('oportunidad'));
    var termino = o.get('fecha_termino') || o.get('fecha_inicio');
    if (!termino || termino >= hoy) {
      throw new BadRequestError(
        'Tienes un cupo tomado en "' + o.get('nombre') + '", que todavía no ocurre. ' +
        'Escríbenos para resolverlo y después puedes cerrar tu cuenta.');
    }
  }
  e.next();
}, 'users');

/* ============================================================
   PUBLICACIÓN PROGRAMADA
   ------------------------------------------------------------
   Una oportunidad en estado "programada" sale al aire sola cuando
   llega su fecha. Corre a las 12:00 UTC, que es el mediodía de Chile:
   así una programada para el día 5 aparece el 5 por la mañana y no a
   las 21:00 del día 4, que es lo que pasaba comparando en UTC.
   ============================================================ */

cronAdd('publicar_programadas', '0 12 * * *', function () {
  function hoyEnChile() {
    var ahora = new Date();
    var a = ahora.getUTCFullYear();
    function primerDomingo(ano, mes) {
      var d = new Date(Date.UTC(ano, mes, 1));
      return new Date(Date.UTC(ano, mes, 1 + ((7 - d.getUTCDay()) % 7)));
    }
    var esVerano = ahora >= primerDomingo(a, 8) || ahora < primerDomingo(a, 3);
    return new Date(ahora.getTime() - (esVerano ? 3 : 4) * 3600 * 1000)
      .toISOString().slice(0, 10);
  }

  var hoy = hoyEnChile();
  var listas = $app.findRecordsByFilter(
    'oportunidades',
    'estado = "programada" && fecha_publicacion != "" && fecha_publicacion <= {:hoy}',
    '', 200, 0, { hoy: hoy }
  );
  listas.forEach(function (o) {
    o.set('estado', 'publicada');
    $app.save(o);
    console.log('Publicada por programación: ' + o.get('nombre'));
  });
});

/* Guardar una oportunidad como programada exige decir cuándo, y que esa
   fecha no sea posterior al cierre de postulaciones: si no, se
   publicaría cuando ya no se puede postular. */
function revisarProgramada(e) {
  if (e.record.get('estado') === 'programada') {
    var cuando = e.record.get('fecha_publicacion');
    if (!cuando) {
      throw new BadRequestError('Para programar una oportunidad hay que indicar la fecha de publicación.');
    }
    var cierre = e.record.get('cierre_postulacion');
    if (cierre && cuando > cierre) {
      throw new BadRequestError('La fecha de publicación es posterior al cierre de postulaciones.');
    }
  }
  e.next();
}
onRecordCreateRequest(revisarProgramada, 'oportunidades');
onRecordUpdateRequest(revisarProgramada, 'oportunidades');

/* ============================================================
   CABECERAS DE LA API
   ------------------------------------------------------------
   Sobre CORS: PocketBase responde Access-Control-Allow-Origin "*" y no
   deja cambiarlo desde un hook (se escribe después de este middleware).
   Se deja así a conciencia, porque en este diseño no abre un agujero:
   la sesión viaja en la cabecera Authorization, no en una cookie, y un
   sitio ajeno no puede leer el token porque vive en el almacenamiento
   del dominio propio. Desde otro origen solo se puede consultar como
   anónimo, y como anónimo lo único visible son las oportunidades
   publicadas, que ya son públicas.
   Si algún día se pasa a cookies de sesión, esto hay que cerrarlo sí o
   sí, con un proxy delante que filtre el origen.
   ============================================================ */

routerUse(function (e) {
  e.response.header().set('X-Content-Type-Options', 'nosniff');
  e.response.header().set('Referrer-Policy', 'strict-origin-when-cross-origin');
  e.next();
});
