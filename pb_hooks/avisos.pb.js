/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   LOS CUATRO CORREOS AUTOMÁTICOS
   ------------------------------------------------------------
   Era el hueco más grande del service blueprint: el emprendedor
   mandaba su ficha y el sistema no le volvía a hablar nunca. Se
   enteraba solo si se le ocurría entrar al sitio a mirar. Ahora salen
   solos:

     ficha_validada         quedó habilitado para postular
     ficha_correccion       hay algo que arreglar, con la observación
     seleccionado           quedó elegido, con los datos para pagar
     oportunidad_cancelada  el evento se suspendió (12-oct)

   TRES DECISIONES QUE CONVIENE ENTENDER ANTES DE TOCAR ESTO:

   1. Los textos NO están acá. Viven en la colección
      plantillas_correo porque el cliente pidió poder cambiarlos
      después sin depender de un despliegue. Este archivo solo sabe
      reemplazar las marcas entre llaves.

   2. El disparo NO compara contra el estado anterior. En un hook
      posterior al guardado el valor de antes ya no existe, y buscarlo
      obliga a trucos frágiles. En su lugar cada registro guarda
      aviso_estado: de qué estado ya se avisó. El aviso sale cuando el
      estado actual no coincide con ese campo, y el campo se escribe
      DESPUÉS de que el correo salió. Eso da tres cosas gratis: sale
      una sola vez, si el envío falla se reintenta en el próximo
      guardado, y queda por escrito a quién se le avisó qué.

   3. Guardar el registro dentro de su propio hook posterior vuelve a
      disparar el hook. Termina igual, porque en la segunda pasada
      aviso_estado ya coincide con el estado y no hace nada. Está
      hecho a propósito así y no hay que "arreglarlo".

   OJO, la lección de siempre en este proyecto: cada hook corre en su
   propio contexto y no ve nada declarado fuera. La función que arma el
   texto va repetida dentro de cada hook a propósito. Sacarla afuera
   lanza un ReferenceError que PocketBase devuelve como un 400 genérico.
   ============================================================ */

/* 1. La ficha pasó a validada o a corrección. */
onRecordAfterUpdateSuccess(function (e) {
  try {
    var CLAVES = { validada: 'ficha_validada', correccion: 'ficha_correccion' };
    var estado = e.record.get('estado');
    var clave = CLAVES[estado];
    if (!clave) { e.next(); return; }
    if ((e.record.get('aviso_estado') || '') === estado) { e.next(); return; }

    var plantillas = $app.findRecordsByFilter(
      'plantillas_correo', 'clave = {:c} && activa = true', '', 1, 0, { c: clave });
    if (!plantillas.length) { e.next(); return; }
    var pl = plantillas[0];

    var usuario = $app.findRecordById('users', e.record.get('usuario'));
    var correo = usuario.get('email');
    if (!correo) { e.next(); return; }

    /* Las observaciones son un objeto {seccion: texto}: se aplanan a algo
       legible, porque el emprendedor no sabe qué es una "sección". */
    var SECCIONES = {
      representante: 'Quién representa', emprendimiento: 'El emprendimiento',
      clasificacion: 'Qué vendes', productos: 'Tus productos',
      formalizacion: 'Formalización', general: 'General'
    };
    /* Un campo JSON no vuelve como objeto: vuelve como los BYTES del
       texto, o sea un arreglo de números. Y como un arreglo también es
       "object", preguntar por typeof no sirve de nada: el for..in recorría
       los índices de los bytes y el correo salía con líneas tipo "0: 123".
       Es la misma trampa que ya está documentada en seguridad.pb.js para
       el historial de las postulaciones. */
    function comoObjeto(valor) {
      if (!valor) return {};
      if (Array.isArray(valor)) {
        try { return JSON.parse(String.fromCharCode.apply(null, valor)) || {}; }
        catch (errA) { return {}; }
      }
      if (typeof valor === 'string') {
        try { return JSON.parse(valor) || {}; } catch (errB) { return {}; }
      }
      if (typeof valor === 'object') return valor;
      return {};
    }

    var obs = comoObjeto(e.record.get('observaciones'));
    var lineas = [];
    for (var k in obs) {
      if (obs[k]) lineas.push('- ' + (SECCIONES[k] || k) + ': ' + obs[k]);
    }

    var rubro = e.record.get('cla_rubro') || '';
    if (rubro) {
      var filas = $app.findRecordsByFilter(
        'catalogo', 'clave = {:c}', '', 1, 0, { c: rubro });
      if (filas.length) rubro = filas[0].get('nombre');
    }

    var datos = {
      nombre: usuario.get('nombre') || e.record.get('representante_nombre') || '',
      emprendimiento: e.record.get('emp_nombre') || 'tu emprendimiento',
      sitio: 'https://equipouni.cl/cuenta-ficha.html',
      rubro: rubro || 'sin rubro asignado',
      observaciones: lineas.length ? lineas.join('\n') : 'Revisar antecedentes.',
      oportunidad: '',
      transferencia: ''
    };

    function armar(texto) {
      var salida = String(texto || '');
      for (var m in datos) {
        salida = salida.split('{' + m + '}').join(datos[m]);
      }
      return salida;
    }
    function aHtml(texto) {
      return String(texto)
        .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')
        .split('\n').join('<br>');
    }

    var cuerpo = armar(pl.get('cuerpo'));
    $app.newMailClient().send(new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName
      },
      to: [{ address: correo }],
      subject: armar(pl.get('asunto')),
      text: cuerpo,
      html: '<p>' + aHtml(cuerpo) + '</p>'
    }));

    /* Recién acá, con el correo ya enviado. Si el envío falla, esto no
       corre y el próximo guardado lo reintenta. */
    e.record.set('aviso_estado', estado);
    $app.save(e.record);
    /* Sin el correo en el registro: los logs de Coolify los ve cualquiera
       con acceso al panel, y el id basta para encontrar a la persona. */
    console.log('Aviso ' + clave + ' enviado, ficha ' + e.record.id);
  } catch (err) {
    console.log('aviso de ficha: ' + err);
  }
  e.next();
}, 'fichas');

/* 2. La postulación pasó a seleccionado: el aviso lleva los datos de
      transferencia de esa oportunidad y pide el comprobante. Es el
      reemplazo de la pasarela mientras el cliente busque proveedor. */
onRecordAfterUpdateSuccess(function (e) {
  try {
    var estado = e.record.get('estado');
    if (estado !== 'seleccionado') { e.next(); return; }
    if ((e.record.get('aviso_estado') || '') === estado) { e.next(); return; }

    var plantillas = $app.findRecordsByFilter(
      'plantillas_correo', 'clave = "seleccionado" && activa = true', '', 1, 0);
    if (!plantillas.length) { e.next(); return; }
    var pl = plantillas[0];

    var ficha = $app.findRecordById('fichas', e.record.get('ficha'));
    var usuario = $app.findRecordById('users', ficha.get('usuario'));
    var correo = usuario.get('email');
    if (!correo) { e.next(); return; }

    var op = $app.findRecordById('oportunidades', e.record.get('oportunidad'));
    var transferencia = op.get('datos_transferencia') || '';
    if (!transferencia) {
      /* Sin datos de transferencia el correo diría "paga acá" sin decir
         dónde, que es peor que no mandarlo. Se avisa en el registro para
         que el equipo cargue el dato y el próximo guardado lo mande. */
      console.log('Sin datos de transferencia en "' + op.get('nombre') +
                  '": no se manda el aviso de selección.');
      e.next();
      return;
    }

    var datos = {
      nombre: usuario.get('nombre') || ficha.get('representante_nombre') || '',
      emprendimiento: ficha.get('emp_nombre') || 'Tu emprendimiento',
      sitio: 'https://equipouni.cl/cuenta-postulaciones.html',
      rubro: '',
      observaciones: '',
      oportunidad: op.get('nombre') || '',
      transferencia: transferencia
    };

    function armar(texto) {
      var salida = String(texto || '');
      for (var m in datos) {
        salida = salida.split('{' + m + '}').join(datos[m]);
      }
      return salida;
    }
    function aHtml(texto) {
      return String(texto)
        .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')
        .split('\n').join('<br>');
    }

    var cuerpo = armar(pl.get('cuerpo'));
    $app.newMailClient().send(new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName
      },
      to: [{ address: correo }],
      subject: armar(pl.get('asunto')),
      text: cuerpo,
      html: '<p>' + aHtml(cuerpo) + '</p>'
    }));

    e.record.set('aviso_estado', estado);
    $app.save(e.record);
    console.log('Aviso de selección enviado, postulación ' + e.record.id);
  } catch (err) {
    console.log('aviso de selección: ' + err);
  }
  e.next();
}, 'postulaciones');

/* 3. La oportunidad se canceló: se le avisa a TODO el que tenga una
      postulación viva en ella.

      Este es el aviso que faltaba y que nos faltaba a nosotros: el
      estado "cancelada" lo agregamos el 24-sep con el argumento de
      "sigue visible para avisarle a quien postuló", y el aviso no
      existía. Sin él la persona se enteraba llegando a la feria.

      Dos cosas de este hook que NO hay que simplificar:

      a) La postulación se vuelve a leer de la base justo antes de
         mandar, y se revisa de nuevo su marca. Parece redundante y no
         lo es: guardar una postulación dispara el hook 8 de
         seguridad.pb.js, que recalcula los cupos y GUARDA la
         oportunidad, lo que vuelve a entrar acá. Sin la relectura, esa
         segunda pasada manda de nuevo los correos que esta pasada
         todavía tiene en su lista y la persona recibe el aviso dos o
         tres veces.

      b) Solo se avisa a quien tenía certeza de que iba: seleccionado y
         confirmado. Decisión del cliente en la reunión del 2-nov, que
         Diego confirmó el 6-nov: el postulado todavía no sabía si iba a
         quedar, así que el aviso sería información que no necesita. A
         quien no quedó ya se le dijo que no, y quien renunció se bajó
         solo. Hasta el 6-nov también se le avisaba al postulado. */
onRecordAfterUpdateSuccess(function (e) {
  try {
    if (e.record.get('estado') !== 'cancelada') { e.next(); return; }

    var plantillas = $app.findRecordsByFilter(
      'plantillas_correo', 'clave = "oportunidad_cancelada" && activa = true', '', 1, 0);
    if (!plantillas.length) { e.next(); return; }
    var pl = plantillas[0];

    var pendientes = $app.findRecordsByFilter(
      'postulaciones',
      'oportunidad = {:o} && aviso_cancelacion = "" && ' +
      '(estado = "seleccionado" || estado = "confirmado")',
      '', 0, 0, { o: e.record.id });
    if (!pendientes.length) { e.next(); return; }

    var motivo = e.record.get('motivo_cancelacion') || '';
    var nombreOp = e.record.get('nombre') || 'la oportunidad';

    for (var i = 0; i < pendientes.length; i++) {
      try {
        /* Relectura: ver (a) en el comentario de arriba. */
        var p = $app.findRecordById('postulaciones', pendientes[i].id);
        if (p.get('aviso_cancelacion')) continue;

        var ficha = $app.findRecordById('fichas', p.get('ficha'));
        var usuario = $app.findRecordById('users', ficha.get('usuario'));
        var correo = usuario.get('email');
        if (!correo) continue;

        var datos = {
          nombre: usuario.get('nombre') || ficha.get('representante_nombre') || '',
          emprendimiento: ficha.get('emp_nombre') || 'tu emprendimiento',
          sitio: 'https://equipouni.cl/oportunidades.html',
          rubro: '',
          observaciones: '',
          oportunidad: nombreOp,
          transferencia: '',
          motivo: motivo ? 'Motivo: ' + motivo
                         : 'No nos dejaron dicho el motivo. Si quieres saber más, respóndenos este correo.'
        };

        var cuerpo = String(pl.get('cuerpo') || '');
        var asunto = String(pl.get('asunto') || '');
        for (var m in datos) {
          cuerpo = cuerpo.split('{' + m + '}').join(datos[m]);
          asunto = asunto.split('{' + m + '}').join(datos[m]);
        }
        var html = '<p>' + cuerpo
          .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')
          .split('\n').join('<br>') + '</p>';

        $app.newMailClient().send(new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName
          },
          to: [{ address: correo }],
          subject: asunto,
          text: cuerpo,
          html: html
        }));

        /* Recién con el correo enviado, igual que los otros dos avisos:
           si el envío falla, la marca no se escribe y el próximo
           guardado de la oportunidad lo reintenta. */
        p.set('aviso_cancelacion', new Date().toISOString().slice(0, 10));
        $app.save(p);
        console.log('Aviso de cancelación de "' + nombreOp + '" enviado, postulación ' + p.id);
      } catch (errUno) {
        /* Que un destinatario falle no puede dejar sin aviso a los demás. */
        console.log('aviso de cancelación, un postulante: ' + errUno);
      }
    }
  } catch (err) {
    console.log('aviso de cancelación: ' + err);
  }
  e.next();
}, 'oportunidades');

/* 4. CORREOS POR LOTE: POST /api/eu/lote  { oportunidad, tipo }

      Hasta el 6-nov el botón "Enviar este lote" del panel no mandaba
      nada: escribía "listo para copiar" y el envío se hacía a mano. En
      la reunión del 2-nov Diego le dijo al cliente que quedaban
      automáticos, y esto es eso.

      Dos lotes, cada uno con su plantilla editable en el panel:
        confirmado  a quien ya pagó: lugar, fechas y horario
        resultado   a quien no quedó (postulado o no_seleccionado), y
                    solo con la postulación ya cerrada: antes es decirle
                    "no quedaste" a alguien que todavía puede quedar

      El de seleccionados no está acá a propósito: ya sale solo, uno por
      uno, al marcar a alguien como seleccionado (hook 2 de este archivo).

      Cada postulación guarda en avisos_lote qué lote recibió y cuándo.
      Apretar dos veces no le manda el mismo correo dos veces a nadie, y
      si un envío falla a la mitad, volver a apretar manda solo lo que
      faltó. La marca se escribe DESPUÉS de que el correo salió, igual que
      en los otros avisos.

      Lo valida el servidor y no la pantalla: solo un administrador puede
      dispararlo, aunque llame a la ruta directo. */
routerAdd('POST', '/api/eu/lote', function (e) {
  var auth = e.auth;
  if (!auth || !auth.get || auth.get('rol') !== 'admin') {
    throw new ForbiddenError('Solo el equipo de EquipoUni puede mandar correos por lote.');
  }

  var cuerpo = e.requestInfo().body || {};
  var TIPOS = {
    confirmado: { plantilla: 'lote_confirmado', estados: ['confirmado'] },
    resultado:  { plantilla: 'lote_resultado',  estados: ['postulado', 'no_seleccionado'] }
  };
  var t = TIPOS[cuerpo.tipo];
  if (!t) throw new BadRequestError('No existe ese tipo de lote.');

  var op;
  try { op = $app.findRecordById('oportunidades', cuerpo.oportunidad || ''); }
  catch (err) { throw new NotFoundError('No existe esa oportunidad.'); }

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

  if (cuerpo.tipo === 'resultado') {
    var estadoOp = op.get('estado');
    var cierre = op.get('cierre_postulacion') || '';
    var abierta = (estadoOp === 'publicada' || estadoOp === 'oculta') && cierre >= hoy;
    if (abierta) {
      throw new BadRequestError('La postulación sigue abierta hasta el ' + cierre +
        '. El resultado se manda cuando cierre, o le dirías "no quedaste" a gente que todavía puede quedar.');
    }
  }

  var plantillas = $app.findRecordsByFilter(
    'plantillas_correo', 'clave = {:c} && activa = true', '', 1, 0, { c: t.plantilla });
  if (!plantillas.length) {
    throw new BadRequestError('La plantilla de este lote está desactivada en Comunicaciones.');
  }
  var pl = plantillas[0];

  /* Un campo JSON vuelve como los BYTES del texto, no como objeto: es la
     trampa documentada en el encabezado de este archivo. */
  function comoObjeto(valor) {
    if (!valor) return {};
    if (Array.isArray(valor)) {
      try { return JSON.parse(String.fromCharCode.apply(null, valor)) || {}; }
      catch (errA) { return {}; }
    }
    if (typeof valor === 'string') {
      try { return JSON.parse(valor) || {}; } catch (errB) { return {}; }
    }
    if (typeof valor === 'object') return valor;
    return {};
  }

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fechas(ini, fin) {
    if (!ini) return 'por confirmar';
    var a = String(ini).split('-'), b = String(fin || ini).split('-');
    var da = +a[2], ma = MESES[+a[1] - 1], db = +b[2], mb = MESES[+b[1] - 1];
    if (ini === (fin || ini)) return da + ' de ' + ma;
    if (a[1] === b[1] && a[0] === b[0]) return da + ' al ' + db + ' de ' + mb;
    return da + ' de ' + ma + ' al ' + db + ' de ' + mb;
  }
  var COMUNAS = {
    '04101': 'La Serena', '04102': 'Coquimbo', '04103': 'Andacollo', '04104': 'La Higuera',
    '04105': 'Paihuano', '04106': 'Vicuña', '04201': 'Illapel', '04202': 'Canela',
    '04203': 'Los Vilos', '04204': 'Salamanca', '04301': 'Ovalle', '04302': 'Combarbalá',
    '04303': 'Monte Patria', '04304': 'Punitaqui', '04305': 'Río Hurtado'
  };
  var partesLugar = [op.get('lugar'), op.get('direccion'), COMUNAS[op.get('comuna')]]
    .filter(function (x) { return x; });

  var filtro = 'oportunidad = {:o} && (' +
    t.estados.map(function (s) { return 'estado = "' + s + '"'; }).join(' || ') + ')';
  var posts = $app.findRecordsByFilter('postulaciones', filtro, '', 0, 0, { o: op.id });

  var enviados = 0, yaTenian = 0, fallidos = [];
  for (var i = 0; i < posts.length; i++) {
    var nombreEmp = '';
    try {
      /* Relectura justo antes de mandar, por la misma razón que en el
         aviso de cancelación: guardar la postulación dispara el recálculo
         de cupos, que guarda la oportunidad. */
      var p = $app.findRecordById('postulaciones', posts[i].id);
      var marcas = comoObjeto(p.get('avisos_lote'));
      if (marcas[cuerpo.tipo]) { yaTenian++; continue; }

      var ficha = $app.findRecordById('fichas', p.get('ficha'));
      var usuario = $app.findRecordById('users', ficha.get('usuario'));
      nombreEmp = ficha.get('emp_nombre') || '';
      var correo = usuario.get('email');
      if (!correo) { fallidos.push((nombreEmp || p.id) + ': no tiene correo'); continue; }

      var asistencia = op.get('asistencia') || '';
      var datos = {
        nombre: usuario.get('nombre') || ficha.get('representante_nombre') || '',
        emprendimiento: nombreEmp || 'tu emprendimiento',
        oportunidad: op.get('nombre') || '',
        fechas: fechas(op.get('fecha_inicio'), op.get('fecha_termino')),
        lugar: partesLugar.length ? partesLugar.join(', ') : 'por confirmar',
        horario: op.get('horario') || 'por confirmar',
        asistencia: asistencia ? 'Asistencia: ' + asistencia : '',
        sitio: 'https://equipouni.cl/oportunidades.html'
      };
      var texto = String(pl.get('cuerpo') || ''), asunto = String(pl.get('asunto') || '');
      for (var m in datos) {
        texto = texto.split('{' + m + '}').join(datos[m]);
        asunto = asunto.split('{' + m + '}').join(datos[m]);
      }
      var html = '<p>' + texto
        .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')
        .split('\n').join('<br>') + '</p>';

      $app.newMailClient().send(new MailerMessage({
        from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
        to: [{ address: correo }],
        subject: asunto,
        text: texto,
        html: html
      }));

      marcas[cuerpo.tipo] = hoy;
      p.set('avisos_lote', marcas);
      $app.save(p);
      enviados++;
    } catch (errUno) {
      /* Que uno falle no deja sin correo a los demás. */
      fallidos.push((nombreEmp || posts[i].id) + ': ' + errUno);
    }
  }

  return e.json(200, { enviados: enviados, yaTenian: yaTenian, fallidos: fallidos });
}, $apis.requireAuth('users'));
