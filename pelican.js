
function pelican( formObj , ajaxOpts )
{
  this.formObj = formObj;
  this.submitBtn = $('input[type=submit]' , formObj ).eq(0);
  this.setupAjax( ajaxOpts );

  $('span.submit',formObj).unbind('click.pelican').bind('click.pelican',function(){
    formObj.submit();
  }); 
}

pelican.prototype.setupAjax = function( ajaxOpts )
{
  var pelican = this;
  ajaxOpts = typeof ajaxOpts == 'object' ? ajaxOpts : {};
  var loaderTargetObj = ajaxOpts.loaderTargetObj ? ajaxOpts.loaderTargetObj : pelican.submitBtn;

  var defaultOpts = {
    success: function( response , status , xhr ){

      pelican.checkAjaxRedirect( response );

      if( response.hasErrors )
      {
        pelican.handleErrors( response.errors );

        if( response.errorMessage )
          pelican.errorMessage( response.errorMessage );

        return;
      }


      var resetForm = true;

      // connected to an agility list controller object
      if( ajaxOpts.agObj && response.updatedModel )
      {
        if( response.updatedModel.is_new )
        {
          ajaxOpts.agObj.addItem( response.updatedModel );
        }
        else
        {
          ajaxOpts.agObj.updateItem( response.updatedModel );
          resetForm = false;
        }
      }
      else if( response.updatedModel )
        resetForm = false;

      if( response.successMessage )
        pelican.handleSuccess( response.successMessage , ajaxOpts.messageTargetObj , resetForm );      

      if( ajaxOpts.on_success && typeof ajaxOpts.on_success == 'function' ) 
        ajaxOpts.on_success( response , status , xhr );
    },
  
    beforeSend: function(){
      loaderTargetObj.after('<img src="/images/ajax-loader.gif" class="ajax-loader"/>');
      pelican.resetErrors();
    },
    error: function(){
      loaderTargetObj.closest('img.ajax-loader').remove();
      pelican.errorMessage('Oye...there was a server error. Please try again in a few minutes.');
    }
  };

  ajaxOpts = $.extend( {}  , defaultOpts , ajaxOpts );

  this.ajaxOpts = ajaxOpts;

  this.formObj.ajaxForm( ajaxOpts );
}

pelican.prototype.errorMessage = function( message )
{
  var html = ''
   + '<div class="message error">'
   + '  <span class="fa fa-exclamation-triangle"></span> '
   +    String(message)
   + '</div>';

  $('.form-item.submit', this.formObj ).after( html );
}

pelican.prototype.handleErrors = function( errors , field_focus )
{
  var formObj = this.formObj;
  field_focus = typeof field_focus == 'boolean' ? field_focus : true;

  $.each( errors , function( field_id , error_message ){
    var errorMessage = '<div class="form-error-message"><span class="icon red checkmark"></span><div class="error-text">';
    errorMessage += String(error_message);
    errorMessage += '</div><div class="clearfix"></div></div>';

    var fieldObj = $('#'+field_id , formObj );

    fieldObj.addClass('error').bind('keyup.pelican',function(){
      $(this).closest('.form-item').removeClass('error').unbind('keyup.pelican');
    });

    fieldObj.closest('.form-item').append( errorMessage );
  });

  if( field_focus )
    $('.form-error-message', formObj ).eq(0).siblings('input,textarea').eq(0).focus();
}

pelican.prototype.resetErrors = function()
{
  $('.form-error-message' , this.formObj ).remove();
  $('input.error,textarea.error', this.formObj).removeClass('error');
  $('.message.error,.message.success').remove();
}

pelican.prototype.reset = function()
{
  this.resetErrors();
  $('input:hidden:not(#form-token), input:text, input:password, input:file, textarea', this.formObj).val('');
  $('select', this.formObj).prop('selectedIndex', 0);
  $('input:radio, input:checkbox', this.formObj).removeAttr('checked').removeAttr('selected');
}

pelican.prototype.handleSuccess = function( message , targetObj , resetForm )
{
  resetForm = typeof resetForm == 'boolean' ? resetForm : true;

  if( resetForm )
    this.reset();

  if( !targetObj )
    targetObj = this.submitBtn.closest('.form-item.submit');

  $('.message.success', targetObj.parent() ).remove();

  targetObj.after('<div class="message success">'+String(message)+'</div>');
  $('.message.success', targetObj.parent() ).delay(2500).fadeOut();
}

pelican.prototype.checkAjaxRedirect = function( response )
{
  if( typeof response == 'object' && response.redirect )
    window.location.href = response.redirect;
}  

pelican.prototype.mapModel = function( model , overrides )
{
  if(!model)
    return;

  var formObj = this.formObj;
  overrides = typeof overrides == 'object' ? overrides : {};

  $.each( model , function( prop , val ){
    $('#' + prop , formObj ).val( val );
  });

  $.each( overrides , function( field_id , model_prop ){
    val = model[ model_prop ];
    $('#' + field_id , formObj ).val( val );
  });  
}

$(function(){
    $('.form-item.error input[type=text],.form-item.error input[type=password],.form-item.error textarea').bind('keyup.pelican',function(){
      $(this).closest('.form-item').removeClass('error').unbind('keyup.pelican');
    });
});
