#version 300 es
precision highp float;

layout(location = 0) out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform sampler2D u_dom;
uniform sampler2D u_coastlineSDF;
uniform vec2 u_scrollPos;
uniform vec2 u_mapOffset;

uniform float u_camZ;
uniform float u_zoom;
uniform float u_xRot;
uniform float u_yRot;

#define PI 3.141592653589793

#define MAX_STEPS 500
#define MAX_DIST 20000.0
#define SURFACE_DIST 0.001

//Constrols scale of plane and camera swell
#define dimAndCam 1500.0

//#define lightPos vec3(sin(uTime*0.05)*700.0, cos(uTime*0.05)*700.0, -600.0)
#define lightPos vec3(sin(uTime*0.5) * 1000.0, cos(uTime*0.3) * 500.0, -900.0)
#define ambientLight 0.075

vec3 rotZ(vec3 p, float angle) {
	
	mat3 m = mat3(cos(angle), -sin(angle), 0.0,
				  sin(angle), cos(angle), 0.0,
				  0.0, 0.0, 1.0);
				  
	return m * p;
}

vec3 rotY(vec3 p, float angle) {
	
	mat3 m = mat3(cos(angle), 0.0, sin(angle),
				  0.0, 1.0, 0.0,
				  -sin(angle), 0.0, cos(angle));
				  
	return m * p;
}

vec3 rotX(vec3 p, float angle) {
	
	mat3 m = mat3(1.0, 0.0, 0.0,
				  0.0, cos(angle), -sin(angle),
				  0.0, sin(angle), cos(angle));
				  
	return m * p;
}

//A struct that hold both the sdf value and the color
struct Surface {
	float distVal;
	vec4 color;
};

Surface sdBall(vec3 p, vec3 pos, float radius, vec4 col) {
	p = p - pos;
	return Surface((length(p) - radius), col);
	
}


/*
float opRep( in vec3 p, in vec3 c, in float primitive ) {
    vec3 q = mod(p+0.5*c,c)-0.5*c;
    return primitive( q );
}
*/

// UE4's PseudoRandom function
// https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Shaders/Private/Random.ush
float pseudo(vec2 v) {
    v = fract(v/128.)*128. + vec2(-64.340622, -72.465622);
    return fract(dot(v.xyx * v.xyy, vec3(20.390625, 60.703125, 2.4281209)));
}

// Hash without Sine
// https://www.shadertoy.com/view/4djSRW
float hashwithoutsine11(float p)
{
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

//1d random
float random(float seed) {
	float x = fract(sin(seed)*290152.0);
	return x;
}


//Random from book of shaders, section: noise
float randomBOS(in vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))
                 * 43758.5453123);
}

float noise2d(vec2 seed) {

	vec2 i = floor(seed);
	vec2 f = fract(seed);
	
	float lowerLeftCorner = randomBOS(i) * 0.5 + 0.5;
	float lowerRightCorner = randomBOS(i + vec2(1.0, 0.0)) * 0.5 + 0.5;
	float upperRightCorner = randomBOS(i + vec2(1.0, 1.0)) * 0.5 + 0.5;
	float upperLeftCorner = randomBOS(i + vec2(0.0, 1.0)) * 0.5 + 0.5;
	
	/*
	float lowerLeftCorner = noise(uTime + i.x);
	float lowerRightCorner = noise(uTime + i.x);
	float upperRightCorner = noise(uTime + i.x);
	float upperLeftCorner = noise(uTime + i.x);
	*/
	vec2 smoothFract = smoothstep(vec2(0.0), vec2(1.0), f);
	
	//smoothFract.x = quinticSS(f.x);
	//smoothFract.y = quinticSS(f.y);
	
	//float n = mix(lowerLeftCorner, lowerRightCorner, smoothFract.x);
	//n *= mix(upperLeftCorner, upperRightCorner, smoothFract.x);
	//n *= mix(lowerLeftCorner, upperLeftCorner, smoothFract.y);
	//n *= mix(lowerRightCorner, upperRightCorner, smoothFract.y);
	
	float upperCells = mix(upperLeftCorner, upperRightCorner, smoothFract.x);
	float lowerCells = mix(lowerLeftCorner, lowerRightCorner, smoothFract.x);
	
	float n = mix(lowerCells, upperCells, smoothFract.y);
	//float n = mix(mix(lowerLeftCorner, upperLeftCorner, smoothFract.y), mix(lowerRightCorner, upperRightCorner, smoothFract.y), smoothFract.x);
	
	// -- Represents the rate of change now on 2 diagonal lines of box
	float l = abs(lowerLeftCorner - upperRightCorner);
	float u = abs(upperLeftCorner - lowerRightCorner);
	float t = (l + u)/2.0;
	float ballsOfChange = distance(vec2(0.5), f);//length(vec2(abs(upperCells - lowerCells)));
	ballsOfChange = 1.0 - step(t, ballsOfChange);
	
	//n += ballsOfChange;
	//Lines in each cell for debug purposes
	//n += lineAB3(vec2(0.0), vec2(0.0, 1.0), f) + lineAB3(vec2(0.0), vec2(1.0, 0.0), f);
	return n;
	
}

Surface box(vec3 p, vec3 boxPos, vec3 boxDim, vec4 col) {

	p = p - boxPos;
	
	//p = rotX(p, uTime*0.6);
	//p = rotX(p, PI/2.0 - 0.3);
	
	p = abs(p);
	
	p = p - boxDim;
	
	p = max(p, 0.0);
	
	float d = length(p) - 0.2;
	
	return Surface(d*0.25, col);

}

Surface minWithColor(Surface obj1, Surface obj2) {

	if (obj1.distVal < obj2.distVal) {
		return obj1;
	}
	
	return obj2;
}

float noise1d(float seed) {
	
	float rand1 = random(floor(seed));
	float rand2 = random(floor(seed) + 1.0);
	
	return mix(rand1, rand2, smoothstep(0.0, 1.0, fract(seed)));
	
}

vec4 shadeOcean(vec4 boxColor, vec2 uv) {

	vec4 oceanOut = boxColor;
	
	//Coastline distance map
	vec4 cld = texture(u_coastlineSDF, uv);
	
	vec4 lightWater = vec4(0.0, 0.65, 3.95, 1.0);
	vec4 darkWater = vec4(0.0, 0.23, 0.65, 0.9);
	oceanOut = mix(lightWater, darkWater, smoothstep(0.0, 0.2, cld.r+0.12));
	
	//Add some noise as "Water"
	
	float size = 150.0;
    float newSeed = 38.0 + uTime*0.3;
    float n2d = noise2d(vec2(uv.x*size + newSeed, uv.y*(size - 60.0) + newSeed));
    
    float oppositeSeed = (uTime*0.1 + 23.0);
    float opposite = noise2d(vec2(uv.x*size - oppositeSeed, uv.y*size - oppositeSeed));
	
	float combinedNoises = 1.0 - smoothstep(0.0, 0.99, (n2d + opposite)/2.0);
	
	float whiteWave = 1.0 - smoothstep(0.43, 0.5, combinedNoises);
	
	vec4 noiseImg = whiteWave * darkWater;
	noiseImg = (1.0 - whiteWave) * vec4(100.0);
	
	//return mix(oceanOut, noiseImg, combinedNoises);
	
	return mix(oceanOut, noiseImg, 1.0 - whiteWave);

}

Surface plane2(vec3 p, vec4 col) {
	
	//p = rotX(p, uTime*0.6);
	//p = rotX(p, PI/2.0 - 0.3);
	p = rotX(p, u_xRot);
	p = rotZ(p, u_yRot);

	//vec3 llp = lightPos;
	//llp = rotX(p, u_xRot);
	//llp = rotZ(p, u_yRot + PI);
	
	vec3 originalP = p;
	vec3 boxP = p;

	
	vec3 planePos = vec3(0.0, 0.0, 0.0);
	
	p = p - planePos;
	
	
	//p = rotX(p, uTime*0.6);
	float kk2AspectRatio = 1.405;
	
	//For now keep other values here constant and just change planeDim so that everything scales well and with right aspect ratio
	float planeDim = dimAndCam;
	
	float repetitionScaleFactor = 1.0;
	vec2 planeDim2 = vec2(planeDim * kk2AspectRatio, planeDim);
	
	vec2 uv = (p.xy+planeDim2) / (planeDim2 * 2.0);
	
	//p.xy = abs(p.xy) - planeDim2;
	
	//vec2 uv = abs(p.xy);
	//Uv is now: (1, 1) is in middle, (0, 0) is on the 4 corners
	
	//p.xy = max(p.xy, 0.0);
	
	//float d = length(p);
	
	//finite repetition
	//float cc = 0.5;
	//vec3 l = vec3((planeDim * repetitionScaleFactor) * kk2AspectRatio, planeDim * repetitionScaleFactor, 0.0);
	//boxP = boxP - (cc*clamp(round(boxP/cc),-l,l));
	
	
	//Understanding the repetition algo:
	//density defines the "density" how far apart the repetition is
	//float density = 0.5;
	//vec3 nn = vec3(2.0, 0.0, 0.0);
	//vec3 repetitionP = originalP - (density * clamp(round(originalP/density), -nn, nn));
	//Density can be ommitted -> Produces a repetition of -0.5 to 0.5 twice to both positive and negative direction(excluding original origin)
	//So if nn = vec3(2.0, 0.0, 0.0) we get 5 balls total, original and 2 to each side of the origin origin. 
	
	//ATH: "round(originalP*0.5)*2.0" if we would like each coordinate space have the range -1 to 1
	//vec3 repetitionP = (originalP - ( density * clamp(round(originalP/density), -nn, nn)));
	
	//Surface mBalls = sdBall(repetitionP, vec3(0.0, 0.0, 0.0), 0.25, vec4(1.0));
	
	vec4 dommari = texture(u_dom, uv);
	//Coastline distance map
	vec4 cld = texture(u_coastlineSDF, uv);
   	
   	 //cld = cld * 1.0-smoothstep(0.02, 0.06, cld.r);
	
	 //d = d - dommari.r* abs(sin(uTime)*0.1);
	 col = dommari;
	 planePos.z -= dommari.r * 30.0;
	 	
	 vec4 boxColor = vec4(0.68, 0.5, 0.15, 1.0);
	
	 //water
	 if (dommari.r < 0.002) {
	
	 	boxColor = shadeOcean(boxColor, uv);
		vec2 polarPreparation = (uv * 2.0) - 1.0;
		vec2 polarUV = vec2(atan(polarPreparation.y, polarPreparation.x) + PI, length(polarPreparation));
		float displacement = noise2d(vec2(polarUV.x, polarUV.y * 3.0 + cld.r*10.0 + uTime*0.1))*1.0;
		//displacement = step(0.85, noise1d(cld.r*20.0 + uTime + polarUV.y*20.0 + polarUV.x*35.0));
		boxColor += smoothstep(0.90, 1.0, displacement - cld.r) * mix(vec4(0.1, 3.0, 5.0, 1.0), vec4(10.0, 10.0, 10.85, 10.0), cld.r);

		planePos.z += displacement*0.33;
	 	
	 	
	 	/* //Primtive light water
	 	float angle = atan(waterUV.y, waterUV.x) + PI + uTime*0.05;
	 	
	 	float distFromCenter = length(vec2(waterUV.x*0.8, waterUV.y));
	 	//Circular "spirals" like effect
	 	//distFromCenter += sin(angle*10.0 + distFromCenter*10.0 + uTime);
	 	
	 	float n = noise1d(angle*5.0 + 1.0);
	 	
	 	float coastArea = smoothstep(0.8, 0.93, distFromCenter + sin(angle*7.0)*0.05 + n*0.1);
	 	
	 	boxColor = mix(lightWater, darkWater, coastArea);
	 	*/
	 	
	 	
	 	
	 	//boxColor = vec4(n); 
	 	
	 	//Circles radiating out from center in infinete loop
	 	//boxColor += vec4(1.0) * step(sin(distFromCenter*200.0 - uTime*20.0)+0.2, distFromCenter); 
	 	
	 	//vec2 ID = floor(p.xy*0.1);
	 	//vec2 grid = fract(p.xy*0.1);
	 	
	 	//if (pseudo(ID + uTime*0.00001) > 0.95) {
	 		//boxColor = vec4(20.0);
	 	//}
	 	
	 	//boxColor.xy = vec2(grid);	 	
	 	
	 }
	 //snow
	 if (dommari.r > 0.6) {
	 	//boxColor = vec4(1.0);
		 boxColor = mix(boxColor, vec4(1.0), smoothstep(0.45, 0.75, dommari.r));
	 }
	 //Grass
	 if (dommari.r > 0.002 && dommari.r < 0.1) {
	 	boxColor = vec4(0.1, 0.8, 0.3, 1.0);
		//boxColor = mix(boxColor, vec4(0.1, 0.8, 0.3, 1.0), smoothstep(0.3, 0.2, dommari.r));
	}
	
	//boxColor = cld;
	
	//Surface bb = box(boxP, planePos, vec3(0.01, 0.01, 0.1), (dommari+0.2) * boxColor);
	//I add "ambientLight" to dommari. Some values of dommari are 0, but I dont want to multiply boxColor with 0 and get black, hence ambientLight is here.
	//Inigo says make max values of diffuse/object color 0.2. If you want brighter, increase power of lights...
	Surface b = box(originalP, planePos, vec3(planeDim2, 20.0), (boxColor * (dommari + ambientLight))*0.2);
	
	Surface lightOrigin = box(originalP, lightPos, vec3(50.0), vec4(1.0));
		
	//Surface ball = sdBall(originalP, vec3(0.0, 0.0, -170.0), 25.0, vec4(1.0));
		
	//Surface ballMap = sdBall(boxP, planePos, 1.0, (dommari + 0.2) * boxColor);
	
	//Surface plaane = Surface(d, col);
	

	
	return minWithColor(b, lightOrigin);
	
}


Surface getDist(vec3 p) {
	
	//Surface ball = sdBall(p, 0.8, vec4(1.0));
	
	Surface plane2 = plane2(p, vec4(1.0));
	
	return plane2;

}

Surface rayMarch(vec3 rayOrigin, vec3 rayDirection) {
	
	Surface closestObject = Surface(0.0, vec4(1.0, 0.0, 0.0, 1.0));
	//Surface curStop;
	
	for(int i = 0; i < MAX_STEPS; i++) {
		//The current stop (blue point from video). Will in first iteration just be the rayOrigin
		vec3 currentStop = rayOrigin + (closestObject.distVal * rayDirection);
		//Distance to the closes "thing" in our scene
		Surface distToScene = getDist(currentStop);
		closestObject.distVal += distToScene.distVal;
		closestObject.color = distToScene.color;

		//Glow
		//if (distToScene.distVal < SURFACE_DIST + 1000.9 && distToScene.distVal > SURFACE_DIST) {
			//closestObject.color = vec4(float(i)*300.0);
		//}
		
		// we have a hit || The distance is too large, this ray hit nothing. we marched past everything, dont want to march to infinity 
		if (closestObject.distVal > MAX_DIST || distToScene.distVal < SURFACE_DIST) {
			break;
		}
		
	}
	
	return closestObject;

}

vec3 getNormals(vec3 p) {
	
	//Gets distance to all objects in the scene
	float d = getDist(p).distVal;
	
	//I want to sample 4 points around each single point
	vec2 pOffset = vec2(0.1, 0.0);
	
	//In the end calculates rate of change(derivative) and gives us a vec3 representation of that,
	//It happesn to be that this is the normal of the surface
	vec3 normals = d - vec3(getDist(p - pOffset.xyy).distVal, 
						getDist(p - pOffset.yxy).distVal, 
						getDist(p - pOffset.yyx).distVal);
						
	//normals.xy += 0.1 * noise1d(p.y + p.x); 
	
	return normalize(normals);
}


float getLight(vec3 p, vec3 normals) {
	
	vec3 lightPosition = lightPos;
	//lightPosition.xz += vec2(cos(uTime)*5.0, sin(uTime)*5.0);
	//Makes p the origin for all lightVectors
	vec3 lightVector = normalize(lightPosition - p);
	
	//vec3 normals = getNormals(p);
	
	float diff = dot(normals, lightVector);
	diff = clamp(diff, 0.0, 1.0);
	
	return diff;
}
/*
//Version of triplanar mapping
// "p" point being textured
// "n" surface normal at "p"
// "k" controls the sharpness of the blending in the transitions areas
// "s" texture sampler
vec4 boxmap( in sampler2D s, in vec3 p, in vec3 n, in float k )
{
    // project+fetch
    vec4 x = texture( s, p.yz );
    vec4 y = texture( s, p.zx );
    vec4 z = texture( s, p.xy );
    
    // blend factors
    vec3 w = pow( abs(n), vec3(k) );
    // blend and return
    return (x*w.x + y*w.y + z*w.z) / (w.x + w.y + w.z);
}
*/

/*
	Shadows.
	How it works: Raymarch from the scene to the lightPosition. Takes maxT steps from
	each surfacePoint of geometry-sdf towards the ligthPosition. If it hits something on
	its way from surface to ligthDirection(if a currentDistance is less than 0.001) 
	then that point should be in the shade! return of 0.0 means it should be in shade.
	
	If we have taken maxT steps and not collided with anything, then its not in hte
	shade and we return 1.0.
	
*/

float shadow(vec3 rayOrigin, vec3 rayDir, float minT, float maxT) {
	
	//Its possible to ommit the interval in for loop construct,
	//the increment is done at the bottom of he loop.
	for (float t = minT; t < maxT;) {
		float currentDist = getDist(rayOrigin + (rayDir*t)).distVal;
		if (currentDist < 0.001) {
			return 0.0;
		}
		t += currentDist;
	}
	return 1.0;
}

//Dont think its udeful for this project.
//Dont understand the soft shadow version yet see: https://iquilezles.org/www/articles/rmshadows/rmshadows.htm
float softshadow( in vec3 ro, in vec3 rd, float mint, float maxt, float k )
{
    float res = 1.0;
    for( float t=mint; t<maxt; )
    {
        float h = getDist(ro + rd*t).distVal;
        if( h<0.001 )
            return 0.0;
        res = min( res, k*h/t );
        t += h;
    }
    return res;
}
/*
Applies fog to whole scene. 
"col" is the original color for the pixel, could be final image before lasttly applying fog
"dist" is the distance from the origin/camera to each surface-point in scene.
*/
vec3 applyFog(vec3 col, float dist) {
	
	float fogAmount = 1.0 - exp(-dist*0.00006);
	vec3 fogColor = vec3(0.5, 0.6, 1.3);
	return mix(col, fogColor, fogAmount);

}

/*
//2D raymarching maybe??
vec3 applyOcean(vec3 col, vec3 p) {
	
	
    //vec3 outCol = col;
    vec3 outCol = vec3(0.0);

	float planeDim = dimAndCam;
	
	vec2 planeDim2 = vec2(planeDim * 1.405, planeDim);
	
	vec2 uv = (p.xy+planeDim2) / (planeDim2 * 2.0);
	vec2 rayUV = (uv*2.0) - 1.0;
	
	float d = length(rayUV);
	
	//outCol += 1.0 - step(0.2, d);
	
	if (uv.x < -0.9) {
		//outCol = vec3(1.0);
		//p = vec3(0.0);
	}
	
	if (col.r > 0.001) {
		//outCol = vec3(1.0, 0.0, 0.0);
		uv = vec2(0.0);
	}
	
	
	//Raymarch
	vec2 rayOrigin = vec2(uv.x, uv.y);
	float angle = atan(uv.y - 0.5, uv.x - 0.5);
	//Raymarch from middle and in all directions in circular fashion
	vec2 rayDir = normalize(vec2(cos(angle + PI), sin(angle + PI)));
	//vec2 rayDir = normalize(vec2(cos(0.0), sin(0.0)));
	vec4 dommari = texture(u_dom, uv);
	//Accumulated distance
	float accumDist = 0.0;
	
	for (int i = 0; i < 100; i++) {
		//rayDir += (hashwithoutsine11(accumDist) - 0.5)*0.16;
		
		vec2 currentStop = rayOrigin + (rayDir * accumDist);
		
		float currentDist = length(currentStop)*0.02;
		
		accumDist += 0.05;
		
		if (accumDist > 1.0) {
			break;
		}
		//Case for stopping marching
		if (texture(u_dom, currentStop).r > 0.01) {
			//outCol = vec3(0.0, 1.0, 0.0);
			if (i < 1) {
				accumDist = 0.0;
			}
			break;
		}
		
		if (i > 98) {
			//accumDist = 0.0;
			break;
		}
		
	}
	
	if (accumDist == 0.0) {
		accumDist = 1.0;
	}
	
	//outCol += accumDist;
	
	if (outCol.b > 0.07) {
		//outCol = vec3(1.0);
	}
	
	//outCol = mix(vec3(0.0, 0.65, 3.95), col, accumDist);
	
	//Strat 2:
	vec2 pixelSize = 1.0 / textureSize(u_dom, 0);
	
	vec2 northNaboUV = uv + (vec2(0.0, 1.0) * pixelSize);
	vec4 nn = texture(u_dom, northNaboUV);
	
	vec2 southNaboUV = uv + (vec2(0.0, -1.0) * pixelSize);
	vec4 ss = texture(u_dom, southNaboUV);
	
	vec2 westNaboUV = uv + (vec2(-1.0, 0.0) * pixelSize);
	vec4 ww = texture(u_dom, westNaboUV);
	
	vec2 eastNaboUV = uv + (vec2(1.0, 0.0) * pixelSize);
	vec4 ee = texture(u_dom, eastNaboUV);
	
	int seaCounter = 0;
	
	if (nn.a < 0.1) {
		seaCounter += 1;
	}
	if (ss.a < 0.1) {
		seaCounter += 1;
	}
	if (ww.a < 0.1) {
		seaCounter += 1;
	}
	if (ee.a < 0.1) {
		seaCounter += 1;
	}
	
	if (seaCounter >= 1 && seaCounter <= 3) {
		outCol = vec3(1.0);
		uv = vec2(0.0);
	}
	
	
	return 1.0 - outCol; //dommari;
	
}
*/

//View matrix
mat4 lookAt(vec3 from, vec3 to) {
	//Z-axis
	vec3 forward = normalize(from - to);
	//X-axis
	vec3 tempUp = vec3(0.0, 1.0, 0.0);
	//Cross product finds a third vector that is perpendicular to tempUp and forward.
	//Note: order matters in cross product, it defines if the output vector is positive or negative f.ex on X-axis
	//The right vector always lies on the xz-plane(forward is z, cross forward and up and now we x, which with forward-z creates a plane)
	vec3 right = cross(tempUp, forward);
	
	//Y-axis
	vec3 up = cross(forward, right);
	
	mat4 m = mat4(right, 0.0,
				  up, 0.0,
				  forward, 0.0,
				  from, 1.0);
	return m;

}

//From Art of Code: https://www.shadertoy.com/view/wdGXzK, function R(...)
vec3 R(vec2 uv, vec3 from, vec3 to, float z) {
    vec3 f = normalize(to-from), //forward
        r = normalize(cross(vec3(0,1,0), f)), //Right
        u = cross(f,r), //Up
        
        c = from+f*z,
        i = c + uv.x*r + uv.y*u,
        d = normalize(i-from);
    return d;
}

void main()
{
    vec2 uv = gl_FragCoord.xy/uResolution;
    uv = (uv * 2.0) - 1.0;
    
    float ar = uResolution.x / uResolution.y;
    uv.x = uv.x * ar;
    
    vec3 col = vec3(0.0);
    
    //Init raymarch
    vec3 rayOrigin = vec3(-u_mapOffset.x, u_mapOffset.y, - dimAndCam + u_zoom);
    
    //vec3 lookAt = vec3(-u_mapOffset.x, u_mapOffset.y, 0.0);
    //vec3 rayDirection = R(uv, rayOrigin, lookAt, u_zoom);
   
    vec3 rayDirection = normalize(vec3(uv.x, uv.y, 1.0));
    
    Surface objects = rayMarch(rayOrigin, rayDirection);
    float d = objects.distVal;
    vec3 surfacePoints = rayOrigin + (rayDirection * d);

    vec3 normals = getNormals(surfacePoints);
    
  	float diffuseLighting = getLight(surfacePoints, normals);
  	
  	//vec4 uu = boxmap(u_landsat, surfacePoints*0.0009, normals, 8.0); 
    
    float globalShadows = shadow(surfacePoints + (normals*0.01*2.0), lightPos, 0.0, 16.0);
    //float globalSoftShadows = softshadow(surfacePoints + (normals*0.01*2.0), lightPos, 0.0, 6.0, 2.0);
    
    vec2 planeDim2 = vec2(dimAndCam * 1.405, dimAndCam);
    vec2 iuv = (surfacePoints.xy+planeDim2) / (planeDim2 * 2.0);

	vec3 sunColor = vec3(1.0, 0.85, 0.45);
	vec3 blueSky = vec3(0.2, 0.5, 1.0);

	vec3 diffuseLightWithColor = ((diffuseLighting*5.5) * sunColor + (ambientLight * blueSky));
    
    if (d < MAX_DIST) {
    	//col += objects.color.rgb;
    	//col += d/5.0;
    	//col += mix(vec3(diffuseLighting), objects.color.rgb, 0.55);
    	//col = applyOcean(col, surfacePoints);
    	col += objects.color.rgb * diffuseLightWithColor * (max(globalShadows, 0.1));
    	
    	//col = applyFog(col, d);
    	//col += globalShadows;
    	//col += abs(normals);
    	//col.rgb += texture(u_dom, iuv).rgb;
    	//col.r += iuv.r;
    	//col += uu.rgb;
    	
    } else {
    	//Background color
    	col += mix(vec3(diffuseLighting), vec3(0.0, 0.0, 0.0), 0.95);
    }
    
    //Fog
    //col = applyFog(col, d);
    
    
    
    //Gamma correction
   	col = pow(col, vec3(1.0/2.2));
   	
   	//vec4 tt = texture(u_coastlineSDF, uv);
   	
   	//tt = tt * step(0.93, tt.r);
   	
   	//col.rgb = tt.rgb; // * vec3(1.0, 0.0, 0.0);
   	
   	
    
    outColor = vec4(col, 1.0);
}