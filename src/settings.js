// TODO
// add tooltips for more info
// add experts
// add stdev as an option
// refresh pages when settings update
// update freq for adjavg

var user_settings = {};

//todo add stdev for each rank
var columns = {
    'proj': true,
    'rank': true,
    'ros': true,
    'depth': true,
    'spark': true,
    'avg': true,
    'current': true
};
var update_freq = {
    'player': {
        'time': 30,
        'typ': 'm'
    }
};
//var experts = [];
var misc = {
    'remove_ads': true,
    'fix_css': true,
};

var changes = {};
changes.columns = $.extend(true, {}, columns);
changes.update_freq = $.extend(true, {}, update_freq);
//changes.experts = $.extend(true, {}, experts);
changes.misc = $.extend(true, {}, misc);

var has_change = false;

function check_recursive(d, t) {
    for (k in d) {
        if (d.hasOwnProperty(k)) {
            var v = d[k];
            if ($.isPlainObject(v)) {
                check_recursive(v, t);
            }
            else if (t == 'set') {
                d[k] = false;
            }
            else if (t == 'check') {
                if (v === true) {
                    has_change = true;
                }
            }
        }
    }
}

check_recursive(changes, 'set');

function is_changed() {
    check_recursive(changes, 'check');
    var new_change = has_change;
    has_change = false;
    return new_change;
}

$(function () {
    var save_btn = $('#save');
    save_btn.text('Loading...');
    
    function change_button() {
        if (is_changed()) {
            save_btn.removeAttr('disabled');
            save_btn.text('Save');
        }
        else {
            save_btn.attr('disabled', 'disabled');
            save_btn.text('Save (no changes)');
        }
    }
    
    var column_settings = $('#columns input');
    var freq_ranges = $('input[type="range"]');
    var freq_typs = $('.freq-typ');
    var misc_settings = $('#misc input');
    
    chrome.storage.local.get('fp_user_settings', function(r) {
        save_btn.text('Save (no changes)');
        
        user_settings = r['fp_user_settings'];
        if (!user_settings || Object.keys(user_settings).length <= 0) {
            user_settings = {};
        }

        if (user_settings.hasOwnProperty('columns')) {
            var stored_columns = user_settings.columns;
            $.each(stored_columns, function(k,v) {
                columns[k] = v;
            });
        }
        if (user_settings.hasOwnProperty('update_freq')) {
            var stored_update_freq = user_settings.update_freq;
            $.each(stored_update_freq, function(k,v) {
                update_freq[k] = v;
            });
        }
        /*
        if (user_settings.hasOwnProperty('experts')) {
            experts = user_settings.experts;
        }
        */
        if (user_settings.hasOwnProperty('misc')) {
            var stored_misc = user_settings.misc;
            $.each(stored_misc, function(k,v) {
                misc[k] = v;
            });
        }
        
        // Columns
        $.each(columns, function (k, v) {
            $('#show' + k).prop('checked', v);
        });
                
        column_settings.click(function() {
            var section = 'columns';
            
            var col_set = $(this);
            var check_id = col_set.attr('id').replace('show', '');
            var check_status = col_set.prop('checked');
            
            changes[section][check_id] = columns[check_id] !== check_status;
            
            change_button();
        });
        
        // Freq Time
        freq_ranges.rangeslider({
            polyfill: false,
            onInit: function() {
                $handle = $('.rangeslider__handle', this.$range);
                
                var input_parent = this.$range.siblings('input:first');
                var range_id = input_parent.data('name');
                var stored_range = update_freq[range_id] || {};
                var show_val = stored_range.time || this.value;

                $handle[0].textContent = show_val;
            }
        }).on('input', function() {
            var section = 'update_freq';
            var sub_section = 'time';
            
            var int_val = parseInt(this.value);
            $handle[0].textContent = int_val;
            
            var check_id = $(this).data('name');
            var stored_range = update_freq[check_id] || {};
            
            changes[section][check_id][sub_section] = stored_range[sub_section] !== int_val;

            change_button();
        });
        
        freq_ranges.each(function() {
            var freq_range = $(this);
            var check_id = freq_range.data('name');
            var stored_range = update_freq[check_id] || {};
            var show_val = stored_range.time || freq_range.val();
            freq_range.val(show_val).change();
        });
        
        // Freq Typ
        freq_typs.each(function() {
            var freq_typ = $(this);
            var check_id = freq_typ.data('name');
            var stored_typ = update_freq[check_id] || {};
            freq_typ.val(stored_typ.typ);
        });
        
        freq_typs.change(function() {
            var section = 'update_freq';
            var sub_section = 'typ';

            var freq_typ = $(this);
            var check_id = freq_typ.data('name');
            var freq_status = freq_typ.val();
            var stored_typ = update_freq[check_id] || {};

            changes[section][check_id][sub_section] = stored_typ[sub_section] !== freq_status;
            
            change_button();
        });
        
        // Experts
        //$('#experts').val(experts);
        
        // Misc
        $.each(misc, function (k, v) {
            $('#' + k).prop('checked', v);
        });
                
        misc_settings.click(function() {
            var section = 'misc';

            var misc_set = $(this);
            var check_id = misc_set.attr('id');
            var check_status = misc_set.prop('checked');
            
            changes[section][check_id] = misc[check_id] !== check_status;
            
            change_button();
        });
    });
    
    save_btn.click(function() {
        save_btn.text('Saving...');

        var storage = {'fp_user_settings': {}};
        var storage_settings = storage.fp_user_settings;
        
        // Columns
        var new_columns = {};
        $.each(columns, function (k,v) {
            var show_val = $('#show' + k).prop('checked');
            new_columns[k] = show_val;
        });
        storage_settings.columns = new_columns;
        
        // Update Frequency
        var new_update_freq = {};
        $.each(update_freq, function (k,v) {
            var time_section = freq_ranges.filter('[data-name="' + k + '"]');
            var new_time = parseInt(time_section.val());
            var typ_section = freq_typs.filter('[data-name="' + k + '"]');
            var new_typ = typ_section.val();
            var new_update_dict = {
                'time': new_time,
                'typ': new_typ
            };
            new_update_freq[k] = new_update_dict;
        });
        storage_settings.update_freq = new_update_freq;
        
        // Experts
        //storage_settings.experts = $('#experts').val();
        
        // Misc
        var new_misc = {};
        $.each(misc, function (k, v) {
            var misc_val = $('#' + k).prop('checked');
            new_misc[k] = misc_val;
        });
        storage_settings.misc = new_misc;

        // Store settings
        ga('send', 'event', 'Settings', 'Changed', 'prev: ' + JSON.stringify(user_settings) + '; Current: ' + JSON.stringify(storage_settings));
        chrome.storage.local.set(storage, function() {
            save_btn.text('-> Saved Successfully! <-');
            save_btn.attr('disabled', 'disabled');
            
            columns = new_columns;
            update_freq = new_update_freq;
            misc = new_misc;
            
            check_recursive(changes, 'set');

            //perhaps refresh current page with new settings
        });
    });
});
