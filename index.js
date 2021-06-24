; (function () {
    "use strict"
    window.addEventListener("load", onStart, false);

    var gl;
    var timer;
    var tick_counter;
    var frame_counter;
    var strong_tick_counter;
    var strong_frame_counter;
    //var strong_time;
    //var strong_delta_time;
    var strong_fps;

    var main_camera;
    var main_canvas;
    var input_manager;
    var mouse_manager;
    var lights;
    var streamline_context_static;//the static streamlines
    var streamline_context_dynamic;//interactive streamline placement

    var aliasing;
    var canvas_wrapper_main;
    var input_parameter_wrapper;

    var data_changed = false;
    var settings_changed = false;

    var ui_seeds;
    var time_last_tick = 0;
    var fps_display;
    var current_fps = 0;

    function onStart(evt) {
        console.log("onStart");
        window.removeEventListener(evt.type, onStart, false);
        addOnClickRequestData();
        addOnClickUpdateRenderSettings();
        addOnClickUpdateCamera();
        addOnClickAddSeed();
        addOnClickUpdateURL();
        testWebGPU();

        main_canvas = document.getElementById("main_canvas");
        fps_display = document.getElementById("fps_display");
        

        main_camera = new Camera("main_camera");

        input_manager = new InputManager(main_canvas);
        input_manager.initialize();
        mouse_manager = new MouseManager(main_canvas, main_camera);
        mouse_manager.initialize();

        buildErrorDictionary();

        if (!(gl = getRenderingContext()))
            return;

        ui_seeds = new UISeeds();
        ui_seeds.generateDefaultSeeds();


        lights = new Lights();
        lights.GenerateDefaultLighting();
        streamline_context_static = new StreamlineContext("static", lights, ui_seeds, gl);

        main_camera.SetRenderSizes(1280, 720, 640, 360);
        main_camera.position = glMatrix.vec3.fromValues(0.5399, 0.7699, 0.001);
        main_camera.forward = glMatrix.vec3.fromValues(0.0, 1.0, 0.0);
        main_camera.up = glMatrix.vec3.fromValues(0.0, 0.0, 1.0);

        main_camera.LinkInput(
            document.getElementById("input_camera_position_x"),
            document.getElementById("input_camera_position_y"),
            document.getElementById("input_camera_position_z"),
            document.getElementById("input_camera_forward_x"),
            document.getElementById("input_camera_forward_y"),
            document.getElementById("input_camera_forward_z"),
            document.getElementById("input_camera_up_x"),
            document.getElementById("input_camera_up_y"),
            document.getElementById("input_camera_up_z"));

        aliasing = new Aliasing();

        canvas_wrapper_main = new CanvasWrapper(gl, streamline_context_static, "main", main_canvas, main_camera, aliasing);

        tick_counter = 0;
        frame_counter = 0;
        var strongs = document.querySelectorAll("strong");
        strong_tick_counter = strongs[0];
        strong_frame_counter = strongs[1];
        strong_fps = strongs[2];
        //strong_time = strongs[2];
        //strong_delta_time = strongs[3];

        initializeAttributes();

        input_parameter_wrapper = new InputParameterWrapper(ui_seeds, main_camera);
        input_parameter_wrapper.fromURL();

        CalculateStreamlines(gl);
        UpdateRenderSettings();
        requestAnimationFrame(on_update);
    }

    function on_update(time_now) {
        tick_counter++;
        var deltaTime = (time_now - time_last_tick) / 1000;

        if (input_manager.isKeyDown(input_manager.KEY_INDEX_A)) {
            var slow = false;
            main_camera.moveLeft(deltaTime, slow);
        }
        if (input_manager.isKeyDown(input_manager.KEY_INDEX_D)) {
            var slow = false;
            main_camera.moveRight(deltaTime, slow);
        }
        if (input_manager.isKeyDown(input_manager.KEY_INDEX_W)) {
            var slow = false;
            main_camera.moveForward(deltaTime, slow);
        }
        if (input_manager.isKeyDown(input_manager.KEY_INDEX_S)) {
            var slow = false;
            main_camera.moveBackward(deltaTime, slow);
        }
        if (input_manager.isKeyDown(input_manager.KEY_INDEX_R)) {
            var slow = false;
            main_camera.moveUp(deltaTime, slow);
        }
        if (input_manager.isKeyDown(input_manager.KEY_INDEX_F)) {
            var slow = false;
            main_camera.moveDown(deltaTime, slow);
        }
        if (input_manager.isKeyDown(input_manager.KEY_INDEX_Q)) {
            var left_handed = false;
            main_camera.RollLeft(deltaTime, left_handed);
        }
        if (input_manager.isKeyDown(input_manager.KEY_INDEX_E)) {
            var left_handed = false;
            main_camera.RollRight(deltaTime, left_handed);
        }
        main_camera.repositionCamera();
        main_camera.UpdateShaderValues();
        main_camera.WriteToInputFields();

        canvas_wrapper_main.draw(gl, data_changed, settings_changed, main_camera.mouse_in_canvas);
        frame_counter++;
        frame_counter = canvas_wrapper_main.aliasing_index;
        main_camera.changed = false;
        settings_changed = false;
        data_changed = false;

        //gl.finish();
        current_fps = 1 / deltaTime

        strong_tick_counter.innerHTML = tick_counter;
        strong_frame_counter.innerHTML = frame_counter;
        //strong_time.innerHTML = time_now.toFixed(3);
        //strong_delta_time.innerHTML = deltaTime.toFixed(3);
        strong_fps.innerHTML = current_fps.toFixed(1)
        fps_display.innerHTML = current_fps.toFixed(1)

        time_last_tick = time_now;
        requestAnimationFrame(on_update);
    }

    var buffer;
    function initializeAttributes() {
        gl.enableVertexAttribArray(0);
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
    }

    function cleanup() {
        gl.useProgram(null);
        if (buffer)
            gl.deleteBuffer(buffer);
        if (program)
            gl.deleteProgram(program);
    }

    function addOnClickRequestData() {
        document.getElementById("button_request_data").addEventListener("click", function () {
            console.log("onClickRequestData");
            //MARKER url changes
            //window.location.href = window.location.pathname + '?u=123';
            //window.history.replaceState(null, null, 'index.html?u=123');
            CalculateStreamlines();
            UpdateURL();
        });
    }

    function addOnClickUpdateRenderSettings() {
        document.getElementById("button_render_settings").addEventListener("click", function () {
            console.log("onClickUpdateRenderSettings");
            UpdateRenderSettings();
        });
    }

    function addOnClickUpdateCamera() {
        document.getElementById("button_update_camera").addEventListener("click", function () {
            console.log("onClickUpdateCamera");
            UpdateCamera();
        });
    }

    function addOnClickAddSeed() {
        document.getElementById("button_add_seed").addEventListener("click", function () {
            console.log("onClickAddSeed");
            AddSeed();
        });
    }

    function addOnClickUpdateURL(){        
        document.getElementById("button_update_url").addEventListener("click", function () {
            console.log("onClickUpdateURL");
            UpdateURL();
        });
    }

    function CalculateStreamlines() {
        console.log("CalculateStreamlines");
        var shader_formula_u = document.getElementById("input_field_equation_u").value;
        var shader_formula_v = document.getElementById("input_field_equation_v").value;
        var shader_formula_w = document.getElementById("input_field_equation_w").value;
        var num_points_per_streamline = document.getElementById("input_num_points_per_streamline").value;
        var step_size = document.getElementById("input_step_size").value;
        var segment_duplicator_iterations = document.getElementById("segment_duplicator_iterations").value;
        var direction = DIRECTION_FORWARD;
        streamline_context_static.CalculateStreamlines(gl, shader_formula_u, shader_formula_v, shader_formula_w, num_points_per_streamline, step_size, segment_duplicator_iterations, direction);
        data_changed = true;
    }

    function UpdateRenderSettings() {
        console.log("UpdateRenderSettings");
        settings_changed = true;
        canvas_wrapper_main.max_ray_distance = document.getElementById("input_max_ray_distance").value;
        canvas_wrapper_main.tube_radius = 0.005 * document.getElementById("input_tube_radius_factor").value;

        canvas_wrapper_main.lod_index_panning = document.getElementById("select_lod_panning").value;
        canvas_wrapper_main.lod_index_still = document.getElementById("select_lod_still").value;

        var panning_resolution_factor = document.getElementById("input_panning_resolution_factor").value;
        canvas_wrapper_main.UpdatePanningResolutionFactor(gl, panning_resolution_factor);
    }

    function UpdateCamera() {
        console.log("UpdateCamera");
        main_camera.FromInput();
    }

    function AddSeed(){
        console.log("AddSeed");
        ui_seeds.addSeed();
    }

    function UpdateURL(){
        console.log("UpdateURL");
        var query_string = input_parameter_wrapper.toQueryString();
        window.history.pushState(null, null, 'index.html' + query_string);
    }

    function testWebGPU() {
        async function demo() {
            console.log('B');
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                console.log("testWebGPU error A");
                return;

            }
            const device = await adapter.requestDevice();
            if (!device) {
                console.log("testWebGPU error B");
                return;

            }
            console.log("testWebGPU successful");
            console.log('C');
        }

        console.log('A');
        demo().then(() => {
            console.log('D');
        });

        console.log('E');
    }

})();