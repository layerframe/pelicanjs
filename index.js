
var stringjs = require('string');
var Entities = require('html-entities').XmlEntities;
var entities = new Entities();

function pelican( form_id )
{
  this.form_build = null;
  this.form_validate = null;
  this.form_submit = null;
  this.resetRequest();
  this._form_id = form_id;
};

pelican.prototype.resetRequest = function()
{
  this._post_data = null;
  this._form_validation_errors = {};
  this._field_success_messages = {};
  this._error_message = '';
  this._success_message = '';
  this._updated_model = null;
  this._redirect = null;

  this.store = {};
  this.req = null;
  this.res = null;
}

pelican.prototype.resetFormMessages = function()
{
  this._form_validation_errors = {};
  this._field_success_messages = {};
  this._error_message = '';
  this._success_message = '';
}

pelican.prototype.errorMessage = function( message )
{
  this._error_message = message;
};

pelican.prototype.successMessage = function( message )
{
  this._success_message = message;
};  

pelican.prototype.error = function( field_id , message )
{
  if(typeof this._form_validation_errors[ field_id ] == 'undefined')
    this._form_validation_errors[ field_id ] = [];

  this._form_validation_errors[ field_id ].push( message );
};

pelican.prototype.hasErrors = function()
{
  if(Object.keys(this._form_validation_errors).length || this._error_message)
    return true;
  return false;
};  

pelican.prototype.setErrors = function( errors )
{
  var self = this;
  Object.keys( errors ).each(function( key ){
    self.error( key , errors[ key ] );
  });
};

pelican.prototype.success = function( field_id , message ) 
{
  if(typeof this._field_success_messages[ field_id ] == 'undefined')
    this._field_success_messages[ field_id ] = [];

  this._field_success_messages[ field_id ].push( message );
};

pelican.prototype.get = function( req , res , store )
{
  if(typeof this.form_build != 'function')
    return '';

  this.resetRequest();
  if( typeof store == 'object' )
    this.store = store;

  this.req = req;

  if( req && req.body && Object.keys(req.body).length )
  {
    this.res = res;
    this._post_data = req.body

    this._validate();

    if(!this.hasErrors())
    {
      this._submit();
    }
    else
    {
      // there is no validation function defined, and no submit handler fired, so we must respond ourselves
      if( typeof this.form_validate != 'function' )
      {
        res.json( this.getJson() );
        res.end();
      }      
    }

    return;
  }

  return this._render_html();
};

pelican.prototype.getJson = function()
{
  return {
    errors: this._form_validation_errors , 
    errorMessage: this._error_message,
    success: this._field_success_messages,
    successMessage: this._success_message,
    updatedModel: this._updated_model,
    redirect: this._redirect,
    hasErrors: this.hasErrors()
   }
}

pelican.prototype.json = function()
{
  this.res.json( this.getJson() );
  this.res.end();
}

pelican.prototype.updateModel = function( data )
{
  this._updated_model = data;
}

pelican.prototype.redirect = function( path )
{
  this._redirect = path;
}

/*
 * Do form validation on submission. We must call the form build function once here
 * in order to process any #required flags in field definitions
 */
pelican.prototype._validate = function()
{
  var self = this;
  var form_struct = this._get_form_struct();
  this.resetFormMessages();

  Object.keys( form_struct.fields ).forEach( function( field_key ){
    var elem = form_struct.fields[ field_key ];

    if(!elem.required)
      return;

    var field_id = !elem.id ? field_key : elem.id;

    if(!self._post_data[ field_id ])
      self.error( field_id , 'This field is required' );
  });

  if( typeof this.form_validate == 'function' )
    this.form_validate( this._post_data );
};

/*
 * Run the form submission function. Drupal likes to do a redirect here to prevent form
 * resubmission, but lets make that merely an optional convenience
 */
pelican.prototype._submit = function()
{
  if(typeof this.form_submit != 'function')
    return;

  var form_struct = this._get_form_struct();

  this.form_submit( this._post_data , form_struct );
};

pelican.prototype._get_form_struct = function()
{
  if( typeof this.form_build == 'function' )
    return this.form_build();
  return [];
};

pelican.prototype._make_field_attrs = function( attrs )
{
  if(!attrs)
    return '';

  var attr_html = [];

  Object.keys( attrs ).forEach(function( key ){
    var val = attrs[ key ];

    if( val === true )
      val = 'true';
    if( val === false )
      val = 'false';

    attr_html.push( val ? (key + '="' + entities.encode( val ) + '"') : key );
  });

  return attr_html.join(' ');
};
 
pelican.prototype._get_field_errors = function( elem_id )
{
  var errors = { extra_class: '', html: ''};

  if(!this._form_validation_errors[ elem_id ])
    return errors;

  var error_msg = "<span class='error-sep'>";
  error_msg += this._form_validation_errors[ elem_id ].join("</span><span class='error-sep'>, </span></span>" );
  error_msg += "</span>";

  errors.extra_class = ' error';

  errors.html = ""
   + "<div class='form-error-message'>"
   + "  <div class='error-text'>"
   +      error_msg
   + "  </div>"
   + "  <div class='clearfix'></div>"
   + "</div>";

  return errors;
};  

pelican.prototype._get_field_success = function( elem_id )
{
  var successes = { extra_class: '',html: ''};

  if(!this._field_success_messages[ elem_id ])
    return successes;

  var success_msg = "<span class='success-sep'>";
  success_msg += this._field_success_messages[ elem_id ].join("</span><span class='success-sep'>, </span></span>" );
  success_msg += "</span>";

  successes.extra_class = ' success';

  successes.html = ""
   + "<div class='form-success-message'>"
   + "  <div class='success-text'>"
   +      success_msg
   + "  </div>"
   + "  <div class='clearfix'></div>"
   + "</div>";

  return successes;
};    

pelican.prototype._get_field_value = function( elem )
{
  switch( elem.type ) 
  {
    case 'submit':
    case 'button':
      field_val = elem.hasOwnProperty('value') ? elem.value : '';
    break;
    case 'multiselect':
      if(!elem.hasOwnProperty('default_value'))
        return [];

      return elem.default_value.map( function( field_val ){
        return entities.encode( field_val );
      });
    break;
    default:
      field_val = elem.hasOwnProperty( 'default_value') ? elem.default_value : '';
      if( this._post_data && this._post_data[ elem.id ] )
        field_val = this._post_data[ elem.id ];
    break;
  }

  if(field_val && !elem.html)
    field_val = entities.encode( String(field_val) );

  return (field_val ? field_val : '');
};

/*
 * Take the form_struct object generated previously and actually render html form elements
 */
pelican.prototype._render_html = function()
{
  var self = this;
  var html_elems = [];
  var form_struct = this._get_form_struct();

  var action = form_struct.action;
  action = action ? action : '/';

  var method = form_struct.method;
  method = String( method ? method : 'POST' ).toUpperCase();
  method = method == 'POST' ? 'POST' : 'GET';

  var attrs = form_struct.attributes ? this._make_field_attrs( form_struct.attributes ) : '';
  var form_id = this._form_id;
  var write_error = false;
  var write_success = false;

  html_elems.push( "<form action='" + action + "' method='" + method + "' id='" + form_id + "' " + attrs + ">" );


  var fieldKeys = Object.keys( form_struct.fields );
  var fieldKeyIndex = 0;

  fieldKeys.sort(function( a , b ){

    a = form_struct.fields[ a ];
    b = form_struct.fields[ b ];

    if(!a.hasOwnProperty('weight'))
      a.weight = fieldKeyIndex;

    if(!b.hasOwnProperty('weight'))
      b.weight = 0;

    fieldKeyIndex += 1;

    if( b.weight == a.weight )
      return 0;

    return ( Number(b.weight) > Number(a.weight) ? -1 : 1 );
  });


  fieldKeys.forEach(function( field_key ){

    var elem = form_struct.fields[ field_key ];

    field_type = elem.type ? elem.type : 'text';

    if( field_type == 'markup' )
    {
      html_elems.push( elem.value );
      return;
    }

    if(!elem.id)
      elem.id = field_key;

    render_func = '_render_field_html_' + field_type;

    if( typeof self[ render_func ] == 'function' )
    {
      html = self[render_func]( elem );
      html = stringjs( html ).trim().s.replace(/^\s*\n/g,'');
      html_elems.push( html );
    }

    if( self._error_message && !write_error && elem.type == 'submit')
    {
      write_error = true;
      html_elems.push( "<div class='message error'>" + self._error_message + "</div>" );
    }

    if( self._success_message && !write_success && elem.type == 'submit')
    {
      write_success = true;
      html_elems.push( "<div class='message success'>" + self._success_message + "</div>" );
    }      
  });

  html_elems.push( "</form>" );

  return html_elems.join("\n");
};

pelican.prototype._render_field_html_file = function( elem )
{
  var render_vars = this._make_render_vars( elem );

  return ""
    + render_vars.field_prefix
    + "<input type='file' id='" + render_vars.id + "' name='" + render_vars.id + "' />"
    + render_vars.field_suffix;
}; 

pelican.prototype._render_field_html_hidden = function( elem )
{
  var render_vars = this._make_render_vars( elem );

  return ""
    + render_vars.field_prefix
    + "<input type='hidden' id='" + render_vars.id + "' name='" + render_vars.id + "' value='" + render_vars.value + "' />"
    + render_vars.field_suffix;
};    

pelican.prototype._render_field_html_password = function( elem )
{
  return this._render_field_html_text( elem , 'password' );
};

pelican.prototype._render_field_html_text = function( elem , input_type )
{
  input_type = (input_type ? input_type : 'text');
  var render_vars = this._make_render_vars( elem );

  if( input_type == 'password' )
    render_vars.value = '';

  var placeholder = (elem.placeholder ? "placeholder='" + elem.placeholder + "'" : '');
  var max_length = (elem.maxlength ? elem.maxlength : 200);

   return ""
    +  render_vars.prefix
    + "<div class='form-item text " + render_vars.id + render_vars.errors.extra_class + render_vars.wrapper_class + "'>"
    + "   <label class='form-item-label'>"
    +       render_vars.title
    + "   </label>"
    +     render_vars.field_prefix
    + "   <input type='" + input_type + "' id='" + render_vars.id + "' name='" + render_vars.id + "' value='" + render_vars.value + "' maxlength='" + max_length + "' " + placeholder + " " + render_vars.attrs + " />"
    +     render_vars.field_suffix
    + "   <div class='clearfix'></div>"
    +     render_vars.errors.html
    +     render_vars.successes.html
    + "</div>"
    + render_vars.suffix;
};

pelican.prototype._render_field_html_readonly = function( elem )
{
  var render_vars = this._make_render_vars( elem );

   return ""
    +  render_vars.prefix
    + "<div class='form-item text readonly " + render_vars.id + render_vars.errors.extra_class + render_vars.wrapper_class + "'>"
    + "   <label class='form-item-label'>"
    +       render_vars.title
    + "   </label>"
    +     render_vars.field_prefix
    +     render_vars.value
    +     render_vars.field_suffix
    + "   <div class='clearfix'></div>"
    +     render_vars.errors.html
    +     render_vars.successes.html
    + "</div>"
    + render_vars.suffix;
};


pelican.prototype._render_field_html_button = function( elem )
{
  return this._render_field_html_submit( elem , 'button' );
};

pelican.prototype._render_field_html_submit = function( elem , input_type )
{
  var render_vars = this._make_render_vars( elem );
  input_type = (input_type ? input_type : 'submit');

  return ""
    + render_vars.prefix
    + "<div class='form-item submit " + render_vars.id + render_vars.wrapper_class + "'>"
    + "  <label class='form-item-label'>"
    +      render_vars.title
    + "  </label>"
    +    render_vars.field_prefix
    + "  <input type='" + input_type + "' id='" + render_vars.id + "' name='" + render_vars.id + "' value='" + render_vars.value + "' " + render_vars.attrs + " />"
    +    render_vars.field_suffix
    + "  <div class='clearfix'></div>"
    + "</div>"
    + render_vars.suffix;
};  

pelican.prototype._render_field_html_textarea = function( elem )
{
  var render_vars = this._make_render_vars( elem );
  var placeholder = (elem.placeholder ? " placeholder='" + elem.placeholder + "'" : '');

  return ""
    + render_vars.prefix
    + "<div class='form-item textarea " + render_vars.id + render_vars.errors.extra_class + render_vars.wrapper_class + "'>"
    + "  <label class='form-item-label'>"
    +      render_vars.title
    + "  </label>"
    +    render_vars.field_prefix
    + "  <textarea id='" + render_vars.id + "' name='" + render_vars.id + "' " + render_vars.attrs + placeholder + ">" + render_vars.value + "</textarea>"
    +    render_vars.field_suffix
    + "  <div class='clearfix'></div>"
    +    render_vars.errors.html
    +    render_vars.successes.html
    + "</div>"
    + render_vars.suffix;
};  

pelican.prototype._render_field_html_radios = function( elem )
{
  var render_vars = this._make_render_vars( elem );

  var html = ""
    + render_vars.prefix
    + "<div class='form-item radios " + render_vars.id + render_vars.errors.extra_class + render_vars.wrapper_class + "'>"
    + "  <label class='form-item-label'>"
    +      render_vars.title
    + "  </label>"
    +    render_vars.field_prefix;

  Object.keys( elem.options ).forEach( function( value ){

    var label = elem.options[ value ];

    var checked = (elem.default_value && elem.default_value == value ) ? ' checked' : '';

    html += ""
     + "<input type='radio' name='" + render_vars.id + "'  value='" + value + "'" + checked + "/>"
     + "<span class='radio-label'>" + label + "</span>";
  });

  html += ""
   + "<div class='clearfix'></div>"
   +    render_vars.field_suffix
   +    render_vars.errors.html
   +    render_vars.successes.html
   + "</div>"
   + render_vars.suffix;

   return html;
};

pelican.prototype._render_field_html_checkbox = function( elem )
{
  var render_vars = this._make_render_vars( elem );

  return ""
    + render_vars.prefix
    + "<div class='form-item checkbox " + render_vars.id + render_vars.errors.extra_class + render_vars.wrapper_class + "'>"
    + "  <label class='form-item-label'>"
    +      render_vars.title
    + "  </label>"
    +    render_vars.field_prefix
    + "  <input type='checkbox' id='" + render_vars.id + "' name='" + render_vars.id + "' " + render_vars.attrs + " " + render_vars.checked + " />"
    +    render_vars.field_suffix
    + "  <span class='checkbox-label'>" + render_vars.label + "</span>"
    + "  <div class='clearfix'></div>"
    +    render_vars.errors.html
    +    render_vars.successes.html
    + "</div>"
    + render_vars.suffix;
};

pelican.prototype._render_field_html_checkboxes = function( elem )
{
  var render_vars = this._make_render_vars( elem );

  var html = ""
    + render_vars.prefix
    + "<div class='form-item checkboxes " + render_vars.id + render_vars.errors.extra_class + render_vars.wrapper_class + "'>"
    + "  <label class='form-item-label'>"
    +      render_vars.title
    + "  </label>"
    +    render_vars.field_prefix;

    if(!elem.options)
      elem.options = {};

    Object.keys( elem.options ).forEach( function( value ){

      var option = elem.options[ value ];
      var label = option;
      var checked = '';

      if( typeof option == 'object' ) {
        checked = (option.checked ? ' CHECKED' : '');
        label = option.label;
      }

      html += ""
        + "<span class='checkbox-row'>"
        + "  <input type='checkbox' value='"+ value +"' name='" + render_vars.id + "' " + render_vars.attrs + " " + checked + " />"
        + "  <span class='checkbox-label'>" + label + "</span>"
        + "</span>";
    });   

    html += ""
      + "  <div class='clearfix'></div>"
      +    render_vars.errors.html
      +    render_vars.successes.html
      + "</div>"
      + render_vars.suffix;

  return html;
};

pelican.prototype._render_field_html_multiselect = function( elem )
{
  return this._render_field_html_select( elem , true );
};    

pelican.prototype._render_field_html_select = function( elem , multi )
{
  var render_vars = this._make_render_vars( elem );
  multi = multi ? ' multiple' : '';
  var default_value = (elem.default_value ? elem.default_value : '' );

  var html = ""
    + render_vars.prefix
    + "<div class='form-item select " + render_vars.id + render_vars.errors.extra_class + render_vars.wrapper_class + "'>"
    + "  <label class='form-item-label'>"
    +      render_vars.title
    + "  </label>"
    +    render_vars.field_prefix
    + "  <select" + multi + " id='" + render_vars.id + "' name='" + render_vars.id + "' " + render_vars.attrs + ">";

  if(!elem.options)
    elem.options = {};

  Object.keys( elem.options ).forEach( function( value ){

    var label = elem.options[ value ];

    if( typeof label == 'object')
    {
      html += "<optgroup label='" + value + "'>\n";

      Object.keys( label ).forEach( function( optgroup_value ){

        var optgroup_label = label[ optgroup_value ];

        if(typeof default_value == 'object')
          selected = (default_value.indexOf( optgroup_value ) != -1 ? ' SELECTED' : '');
        else
          selected = (optgroup_value == default_value ? ' SELECTED' : '');

        html += "<option value='" + optgroup_value + "'" + selected + ">" + optgroup_label + "</option>\n";
      });

      html += "</optgroup>\n";

      return;
    }

    if(typeof default_value == 'object')
      selected = (default_value.indexOf( value ) != -1 ? ' SELECTED' : '');
    else
      selected = (value == default_value ? ' SELECTED' : '');

    html += "<option value='" + value + "'" + selected + ">" + label + "</option>\n";
  });

  html += ""
    + "  </select>"
    +    render_vars.field_suffix
    + "  <div class='clearfix'></div>"
    +    render_vars.errors.html
    +    render_vars.successes.html      
    + "</div>"
    + render_vars.suffix;

  return html;
};  

pelican.prototype._make_render_vars = function( elem )
{
  var elem_id = elem.id;
  
  return {
    id: elem_id,
    value: this._get_field_value( elem ),
    attrs: elem.attributes ? this._make_field_attrs( elem.attributes ) : '',
    title: elem.title ? elem.title : '',
    label: elem.label ? elem.label : '',
    checked: elem.checked ? ' checked="checked"' : '',
    errors: this._get_field_errors( elem_id ),
    successes: this._get_field_success( elem_id ),
    field_prefix: elem.field_prefix ? "<span class='field-prefix'>" + elem.field_prefix + "</span>" : '',
    field_suffix: elem.field_suffix ? "<span class='field-suffix'>" + elem.field_suffix + "</span>" : '',
    prefix: elem.prefix ? elem.prefix : '',
    suffix: elem.suffix ? elem.suffix : '',
    wrapper_class: elem.wrapper_class ? ' ' + elem.wrapper_class : ''
  };
};


module.exports = pelican;
