/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   LOS TRES CORREOS AUTOMÁTICOS
   ------------------------------------------------------------
   Era el hueco más grande del service blueprint: el emprendedor
   mandaba su ficha y el sistema no le volvía a hablar nunca. Se
   enteraba solo si se le ocurría entrar al sitio a mirar. Ahora salen
   tres avisos solos:

     ficha_validada     quedó habilitado para postular
     ficha_correccion   hay algo que arreglar, con la observación
     seleccionado       quedó elegido, con los datos para pagar

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
    console.log('Aviso ' + clave + ' enviado a ' + correo);
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
    console.log('Aviso de selección enviado a ' + correo);
  } catch (err) {
    console.log('aviso de selección: ' + err);
  }
  e.next();
}, 'postulaciones');
