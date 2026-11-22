/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   CORREOS DE CUENTA EN ESPAÑOL Y CON ENLACE QUE FUNCIONA
   ------------------------------------------------------------
   Hasta el 22-nov "Olvidé mi contraseña" no servía: el correo llegaba
   en inglés con un enlace a equipouni.cl/_/..., que es la dirección del
   panel de PocketBase pero en el dominio del sitio, donde no existe
   (404 comprobado contra producción). PocketBase arma el enlace con
   {APP_URL}, que es el sitio, y el sitio no tenía una página que lo
   recibiera.

   Ahora los dos correos de cuenta (recuperar contraseña y confirmar un
   correo nuevo, que se agregó con "Datos de la cuenta" el 22-nov)
   llevan a confirmar.html, que habla con la API.
   ============================================================ */

migrate(function (app) {
  var users = app.findCollectionByNameOrId('users');

  users.resetPasswordTemplate.subject = 'Cambia tu contraseña de {APP_NAME}';
  users.resetPasswordTemplate.body =
    '<p>Hola,</p>\n' +
    '<p>Pediste cambiar la contraseña de tu cuenta en {APP_NAME}. Para elegir una nueva, ' +
    'abre este enlace:</p>\n' +
    '<p><a class="btn" href="{APP_URL}/confirmar.html?accion=clave&token={TOKEN}" ' +
    'target="_blank" rel="noopener">Elegir una contraseña nueva</a></p>\n' +
    '<p>El enlace vence en 30 minutos. Si no lo pediste tú, ignora este correo: ' +
    'tu contraseña sigue siendo la misma.</p>\n' +
    '<p>Equipo de {APP_NAME}</p>';

  users.confirmEmailChangeTemplate.subject = 'Confirma tu nuevo correo en {APP_NAME}';
  users.confirmEmailChangeTemplate.body =
    '<p>Hola,</p>\n' +
    '<p>Pediste usar este correo para entrar a {APP_NAME}. Para confirmarlo, abre este ' +
    'enlace y escribe tu contraseña:</p>\n' +
    '<p><a class="btn" href="{APP_URL}/confirmar.html?accion=correo&token={TOKEN}" ' +
    'target="_blank" rel="noopener">Confirmar mi nuevo correo</a></p>\n' +
    '<p>Hasta que lo confirmes, sigues entrando con tu correo anterior. Si no lo ' +
    'pediste tú, ignora este mensaje.</p>\n' +
    '<p>Equipo de {APP_NAME}</p>';

  app.save(users);
}, function (app) {
  var users = app.findCollectionByNameOrId('users');
  users.resetPasswordTemplate.subject = 'Reset your {APP_NAME} password';
  users.resetPasswordTemplate.body =
    '<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n' +
    '  <a class="btn" href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}" target="_blank" ' +
    'rel="noopener">Reset password</a>\n</p>\n<p><i>If you didn\'t ask to reset your password, ' +
    'please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>';
  users.confirmEmailChangeTemplate.subject = 'Confirm your {APP_NAME} new email address';
  users.confirmEmailChangeTemplate.body =
    '<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n' +
    '  <a class="btn" href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" target="_blank" ' +
    'rel="noopener">Confirm new email</a>\n</p>\n<p><i>If you didn\'t ask to change your email ' +
    'address, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>';
  app.save(users);
});
