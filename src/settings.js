// TODO
// add tooltips for more info
// add individual experts
// add stdev as an option
// refresh pages when settings update
// update freq for adjavg
// put changes detected warning at the top

var user_settings = {};

//todo add stdev for each rank
var columns = {
    'proj': true,
    'rank': true,
    'ros': true,
    'depth': true,
    'spark': true,
    'avg': true,
    'med': true,
    'current': true
};
var update_freq = {
    'player': {
        'time': 30,
        'typ': 'm'
    }
};
var experts = {
    'proj': {
        'selection': ['all']
    },
    'rank': {
        'selection': ['all'],
        'num': {
            'top': 10,
            'updated': 1
        }
    },
    'ros': {
        'selection': ['all'],
        'num': {
            'top': 5,
            'updated': 7
        }
    }
};
var misc = {
    'remove_ads': true,
    'fix_css': true,
};

var changes = {};
changes.columns = $.extend(true, {}, columns);
changes.update_freq = $.extend(true, {}, update_freq);
changes.experts = $.extend(true, {}, experts);
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
                else if (v === 'error') {
                    has_change = 'error';
                    break;
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
        var change_status = is_changed();
        if (change_status === 'error') {
            save_btn.attr('disabled', 'disabled');
            save_btn.text('Save (fix errors)');
        }
        else if (change_status === true) {
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
    var expert_sel = $('#experts :input');
    var misc_settings = $('#misc input');
    
    $('input[type="text"][id$=top]').tooltip({
        placement: 'bottom',
        trigger: 'manual',
        template: '<div class="tooltip tooltip-error" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
        title: 'Must be an integer greater than 1'
    });
    $('input[type="text"][id$=updated]').tooltip({
        placement: 'bottom',
        trigger: 'manual',
        template: '<div class="tooltip tooltip-error" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
        title: 'Must be a positive integer'
    });
    
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
        if (user_settings.hasOwnProperty('experts')) {
            var stored_experts = user_settings.experts;
            $.each(stored_experts, function(k,v) {
                experts[k] = v;
            });
        }
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
        $.each(experts, function (k, v) {
            var exp_list = v['selection'];
            if (exp_list.indexOf('all') > -1) {
                $('#experts-' + k + '-selection-all').click();
            }
            else {
                for (var e=0; e<exp_list.length; e++) {
                    var e_val = exp_list[e].toLowerCase();
                    $('#experts-' + k + '-selection-' + e_val).click();
                }
            }

            if (k == 'rank' || k == 'ros') {
                var nums = v['num'];
                $.each(nums, function (a, b) {
                    $('#experts-' + k + '-num-' + a).val(b);
                });
            }
        });
        
        expert_sel.change(function() {
            var section = 'experts';

            var expert_set = $(this);
            var check_split = expert_set.attr('id').split('-');
            var fetch_type = check_split[1];
            var sub_type = check_split[2];
            var fetch_val = check_split[3];
            
            var stored_experts = experts[fetch_type][sub_type];
            var check_val = false;
            var check_status;
            
            var expert_set_tooltip = expert_set.siblings('.tooltip-error');
            
            if (sub_type == 'num') {
                check_status = expert_set.val();
                check_status = Number(check_status);
                var min_num = 0;
                if (fetch_val == 'top') {
                    min_num = 1;
                }
                if (!check_status || !Number.isInteger(check_status) || check_status <= min_num) {
                    expert_set.tooltip('show');
                    check_val = 'error';
                }
                else if (expert_set_tooltip.length) {
                    expert_set.tooltip('hide');
                }
            }
            else if (sub_type == 'selection') {
                var row_btns = expert_set.parents('.row').find(':input[type=checkbox]');
                var all_btn = row_btns.filter(function() {
                    return $(this).attr('id').match(/-all$/);
                });
                
                if (fetch_val == 'all') {
                    row_btns.not(expert_set).each(function() {
                        var b = $(this);
                        if (b.prop('checked') === true) {
                            b.parents('.btn').removeClass('active');
                            b.prop('checked', false);
                        }
                    });
                    
                    if (expert_set.prop('checked') !== true) {
                        expert_set.parents('.btn').addClass('active');
                        expert_set.prop('checked', true);
                    }
                }
                else {
                    if (all_btn.prop('checked') === true) {
                        all_btn.parents('.btn').removeClass('active');
                        all_btn.prop('checked', false);
                    }
                    
                    if (fetch_type == 'rank' || fetch_type == 'ros') {
                        var top_section = expert_set.parents('#experts-' + fetch_type + '-top');
                        
                        if (top_section.length === 1) {
                            var other_top_btns = top_section.find(':input[type=checkbox]').not(expert_set);
                            
                            other_top_btns.each(function() {
                                var oth_btn = $(this);
                                if (oth_btn.prop('checked') === true) {
                                    oth_btn.parents('.btn').removeClass('active');
                                    oth_btn.prop('checked', false);
                                }
                            });
                        }
                    }
                }
                
                var checked_btns = row_btns.filter(function() {
                    return $(this).prop('checked') == true;
                });
                
                if (checked_btns.length === 0) {
                    all_btn.parents('.btn').addClass('active');
                    all_btn.prop('checked', true);
                    checked_btns = all_btn;
                }
                
                check_status = [];
                checked_btns.each(function() {
                    check_status.push($(this).attr('id').split('-').pop());
                });
            }
            
            
            if (Array.isArray(check_status) && Array.isArray(stored_experts)) {
                check_val = !(stored_experts.length === check_status.length && stored_experts.every(el => check_status.includes(el)));
                changes[section][fetch_type][sub_type] = check_val;
            }
            else {
                if (check_val !== 'error') {
                    check_val = stored_experts[fetch_val] !== check_status;
                }
                changes[section][fetch_type][sub_type][fetch_val] = check_val;
            }

            change_button();
        });
        
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
        
        var settings_height = $('.settings').outerHeight(true);
        var contact_height = $('.contact').outerHeight(true);
        var contact_border_height = $('.contact').outerHeight() - $('.contact').innerHeight();
        $('.changes').height(settings_height - contact_height - contact_border_height);
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
        var new_experts = {};
        $.each(experts, function (k, v) {
            var exp_dict = {};
            var exp_section = $('#experts-' + k);
            
            var exp_sel_checked = exp_section.find(':checked');
            var exp_sel_vals = [];
            
            exp_sel_checked.each(function() {
                var exp_sel_type = $(this).attr('id').split('-').pop();
                exp_sel_vals.push(exp_sel_type);
            });
            
            exp_dict['selection'] = exp_sel_vals;
            
            if (k == 'rank' || k == 'ros') {
                var exp_num_dict = {};
                var text_inputs = exp_section.find('input[type=text]');
                
                text_inputs.each(function() {
                    var exp_num_type = $(this).attr('id').split('-').pop();
                    var exp_num_val = Number($(this).val());
                    exp_num_dict[exp_num_type] = exp_num_val;
                });
                
                exp_dict['num'] = exp_num_dict;
            }
            
            new_experts[k] = exp_dict;
        });
        storage_settings.experts = new_experts;

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
            experts = new_experts;
            misc = new_misc;
            
            check_recursive(changes, 'set');

            //perhaps refresh current page with new settings
        });
    });
});
