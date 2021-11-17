import * as twgl from "./twgl-full.module.js";

console.log("hello i am underwater")

const canvas = document.getElementById("c");
const gl = canvas.getContext("webgl2")

const inputObj = {}

const vertexShaderPromise = fetch("./main.vert").then(
    (response) => {
        return response.text().then( (text) => {
            return text;
        })
    }
)

const fragmentShaderPromise = fetch("./main.frag").then(
    (response) => {
        return response.text().then( (text) => {
            return text;
        })
    }
)

console.log(twgl.isWebGL2(gl))
Promise.all([vertexShaderPromise, fragmentShaderPromise]).then((shadersText) => {
    console.log(shadersText)
    
    const programInfo = twgl.createProgramInfo(gl, shadersText)


    const arrays = {
        //Two triangles make a quad
        a_position: { numComponents: 2, data: [
            -1, -1,
            -1, 1,
            1, -1,

            1, -1,
            1, 1,
            -1, 1,
        ] },
    }

    
    //Camera

    let camZ = 0.0;
    let zoom = 1.0;
    //Will be in range of dimensions of canvas: 0 0 <=> 1200 800
    let scrollPosition = [0.0, 0.0]
    let mapOffset = [0.0, 0.0]
    let xRot = 0.0
    let yRot = 0.0
    let isDown = false

    canvas.addEventListener("mousemove", (e) => {
        //console.log(e)
        if (isDown == true) {
            console.log("hhhhhhhhhh")
            mapOffset[0] += e.movementX
            mapOffset[1] += e.movementY

        }
    })

    canvas.addEventListener("mousedown", (e) => {
        console.log(e)
        isDown = true
    })

    canvas.addEventListener("mouseup", (e) => {
        console.log(e)
        isDown = false
        console.log(mapOffset)
    })

    document.addEventListener("keydown", (e) => {
        console.log(e)
        inputObj[e.key] = true
       
    })

    document.addEventListener("keyup", (e) => {
        console.log(e)
        inputObj[e.key] = false
    })

    canvas.addEventListener("wheel", (e) => {
        console.log(e)
        
        const wheelDir = Math.sign(e.wheelDelta) == 1 ? "forward" : "backwards"
        console.log(wheelDir)
        if (wheelDir === "forward") {
            zoom += 20.0;
        } else {
            zoom -= 20.0;
        }

        //Position of cursow when scrolling
        const x = e.layerX
        const y = e.layerY
        console.log(`X: ${x}  Y: ${y}`)
        scrollPosition[0] = x
        scrollPosition[1] = y


        canvas.focus()
        
    })
    console.log(gl.getParameter(gl.MAX_TEXTURE_SIZE))
    const heightMap = twgl.createTexture(gl, {
        src: "./kk2.png",
        flipY: true,
        minMag: gl.LINEAR
    })

    const coastlineMap = twgl.createTexture(gl, {
        src: "./oid.png",
        flipY: true,
        minMag: gl.LINEAR
    })

    const buffers = twgl.createBufferInfoFromArrays(gl, arrays)

    const uniforms = {
        uTime: 0,
        uResolution: [canvas.clientWidth, canvas.clientHeight],
        u_dom: heightMap,
        u_coastlineSDF: coastlineMap,
        u_camZ: camZ,
        u_zoom: zoom,
        u_scrollPos: scrollPosition,
        u_mapOffset: mapOffset,
        u_xRot: xRot,
        u_yRot: yRot
        
    }

    let oldFrameTime = 0.0;
    const draw = (time) => {
        gl.useProgram(programInfo.program)
        gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight)
        twgl.setBuffersAndAttributes(gl, programInfo, buffers)

        const timeInSeconds = time * 0.001;
        const newFrameTime = timeInSeconds
        const dt = newFrameTime - oldFrameTime
        //console.log("DeltTime: " + dt)
        oldFrameTime = timeInSeconds

        //Input logic
        for (let key in inputObj) {
            //console.log(key)
            //console.log(inputObj[key])
            if (key == "w" && inputObj[key] == true) {
                xRot = xRot + (0.2 * dt)
                console.log("HYYYYYYIIIIIIIIIIIAAAAAAAA")
                console.log(camZ)
            }

            if (key == "s" && inputObj[key] == true) {
                xRot = xRot - (0.2 * dt)
            }

            if (key == "a" && inputObj[key] == true) {
                yRot = yRot - (0.2 * dt)
            }
            if (key == "d" && inputObj[key] == true) {
                yRot = yRot + (0.2 * dt)
            }
        }

        uniforms.u_camZ = camZ
        uniforms.u_zoom = zoom
        uniforms.u_scrollPos = scrollPosition
        uniforms.u_mapOffset = mapOffset
        uniforms.u_xRot = xRot
        uniforms.u_yRot = yRot

        //console.log(timeInSeconds)
        uniforms.uTime = timeInSeconds
        //console.log(inputObj)

        twgl.setUniforms(programInfo, uniforms)
        twgl.drawBufferInfo(gl, buffers, gl.TRIANGLES, 6)

        requestAnimationFrame(draw)
    }
    
    requestAnimationFrame(draw)
})