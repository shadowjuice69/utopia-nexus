<?php

# These headers must be present or else user will get errors.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Max-Age: 1000');

if ($_POST) {

    # Raw content of game div
    $data_html = $_POST['data_html'];

    # Content from game div as if user had copy pasted
    # (useful for parsers that also work with copy/paste)
    $data_simple = $_POST['data_simple'];

    # URL from where data came from
    $url = $_POST['url'];

    # Province that sent intel (will be different when sitting)
    $province = $_POST['prov'];

    # Key (you should give the kingdom, if not each user a personal key,
    # so you can restrict access)
    $key = $_POST['key'];

    $example_array = array($url, $province, $key);

    # Your parse functions here.

    # Return JSON object with first instance being success: true.
    # If you do not do this, the user will get an error.
    echo json_encode(array('success' => true));
}

?>
