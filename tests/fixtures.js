// @ts-check
// The hand-written test scenes, embedded so the suite carries no separate
// fixture files. global-setup writes each entry to static-html/<name>.xml and
// transforms it with xsltproc to static-html/<name>.html.
const SCENES = {

  "compilation": `<COMPILATION name="Test Compilation">
  <METADATA fallback="en">
    <desc>
      <de><![CDATA[Szene auswählen.]]></de>
      <en><![CDATA[Pick a scene.]]></en>
    </desc>
  </METADATA>

  <ENTRY url="text.xml"/>
  <ENTRY url="views.xml"/>
</COMPILATION>
`,

  "directory": `<DIRECTORY name="Test Directory" desc="Various scenes">
  <ENTRY url="text.xml" name="Text sample" desc="A hello world scene."/>
  <ENTRY url="views.xml">
    <METADATA fallback="en">
      <name><en><![CDATA[View system]]></en><de><![CDATA[Ansichten]]></de></name>
      <desc><en><![CDATA[Views and variables.]]></en></desc>
    </METADATA>
  </ENTRY>
</DIRECTORY>
`,

  "link": `<AUGMENTATION>
  <CAMERA>
    <NODE tz="100">
      <TEXT label="Website">
        <LINK refer="https://nodered.jp"/>
      </TEXT>
    </NODE>
  </CAMERA>
</AUGMENTATION>`,

  "marker_click": `<AUGMENTATION viewlist="mc_home,mc_detail" viewswitch="true" viewdisplay="false">
  <IMGTARGET file="markers/photo.jpg" width="2">
    <NODE sxyz="0.001">
      <NODE tx="-17" ty="5" tz="17" view="" collapse="" show="">
        <NODE view="" collapse="" show="">
          <NODE sx="30" sy="1" sz="30" view="" collapse="" show="">
            <MODEL file="images/menu.png" texture="images/menu.png">
              <LINK refer="@view:mc_detail" w="0" h="0" d="1"/>
            </MODEL>
          </NODE>
        </NODE>
      </NODE>
    </NODE>
  </IMGTARGET>
</AUGMENTATION>
`,

  "marker_free": `<AUGMENTATION>
  <TARGETBASE file="CP-System">
    <TARGET marker="marker/CP-AM-DRILL">
      <NODE sxyz="0.5">
        <SIGNAL rgb="f00" status="on"/>
      </NODE>
      <NODE tx="1">
        <MODEL file="cube" texture="fdar_white" tint="#00FF00"/>
      </NODE>
    </TARGET>
  </TARGETBASE>
</AUGMENTATION>
`,

  "model_ar": `<AUGMENTATION>
  <TARGETBASE file="hiro">
    <TARGET marker="hiro">
      <NODE sxyz="0.1">
        <MODEL file="https://festodidacticsw.azurewebsites.net/ar/cp-cloud_om/obj/arrow_blue.glb" />
      </NODE>
    </TARGET>
  </TARGETBASE>
</AUGMENTATION>`,

  // 2x2 operation-panel menu on the AR.js 'hiro' preset marker. Icon centres
  // sit at ±0.22 marker units and each icon is 0.4 units wide, so the whole
  // menu spans 0.84 units — inside the 1-unit black square of the marker.
  "marker_menu": `<AUGMENTATION viewlist="menu_home,v1,v2,v3,v4" viewswitch="true" viewdisplay="false">
  <TARGETBASE file="hiro">
    <TARGET marker="hiro">
      <NODE sxyz="0.4">
        <NODE tx="-0.55" ty="0.55"><MODEL file="planexy" texture="images/menu1.png"><LINK refer="@view:v1" w="0" h="0" d="1"/></MODEL></NODE>
        <NODE tx="0.55" ty="0.55"><MODEL file="planexy" texture="images/menu2.png"><LINK refer="@view:v2" w="0" h="0" d="1"/></MODEL></NODE>
        <NODE tx="-0.55" ty="-0.55"><MODEL file="planexy" texture="images/menu3.png"><LINK refer="@view:v3" w="0" h="0" d="1"/></MODEL></NODE>
        <NODE tx="0.55" ty="-0.55"><MODEL file="planexy" texture="images/menu4.png"><LINK refer="@view:v4" w="0" h="0" d="1"/></MODEL></NODE>
      </NODE>
    </TARGET>
  </TARGETBASE>
</AUGMENTATION>`,

  "signal": `<AUGMENTATION>
  <CAMERA>
    <NODE sxyz="20" tz="100">
      <SIGNAL rgb="f00" status="on"/>
    </NODE>
  </CAMERA>
</AUGMENTATION>`,

  "spec_features": `<AUGMENTATION name="Spec Features" viewlist="main,alt" viewswitch="true" viewdisplay="true" version="550">
  <VALUESERVER predefined="{&quot;bound_tx&quot;:5}">
    <JSON prefix="j_">
      <![CDATA[ { "greet": "hello" } ]]>
    </JSON>
  </VALUESERVER>
  <CAMERA x="0.5" y="0.5" scaleto="w" distance="2">
    <NODE tz="0.2" sxyz="1.34">
      <TEXT label="bordered" rgba="ffffffff" backrgba="000000cc" border="2" width="10" />
    </NODE>
  </CAMERA>
  <VIRTUAL name="vt1" prioritisation="highest">
    <NODE>
      <SIGNAL rgb="0f0" status="on" />
    </NODE>
  </VIRTUAL>
  <IMGTARGET file="markers/photo.jpg" width="2">
    <NODE>
      <REFLECT to="vt1" priority="activated" />
    </NODE>
    <NODE tx="@anim:bound_tx:2" show="false">
      <TEXT label="statically hidden" />
    </NODE>
    <NODE collapse="true">
      <NODE>
        <TEXT label="collapsed subtree" />
      </NODE>
    </NODE>
    <TOUCH w="0.5" h="0.5" d="0.5" rotate="true" scale="true" rgb="0ff">
      <MODEL file="cube" texture="fdar_white" tint="#00FF00" />
    </TOUCH>
    <NODE ty="1">
      <EFFECT type="fire" enabled="true" />
      <COUNTER value="12.3" intdigits="3" fractdigits="1" casergb="222" wheelintrgb="000" wheelfractrgb="a00" />
    </NODE>
    <NODE ty="-1">
      <VUMETER value="0.75" label="pressure" labelmin="low" labelmax="high" />
      <ANIMATION attribute="ty">
        <KEYFRAME value="bound_ty" />
      </ANIMATION>
    </NODE>
  </IMGTARGET>
</AUGMENTATION>
`,

  "text": `<AUGMENTATION>
  <CAMERA>
    <NODE tz="100">
      <TEXT label="Hello World" rgba="00ff0088" width="10" />
    </NODE>
  </CAMERA>
</AUGMENTATION>`,

  "viewer": `<AUGMENTATION>
  <CAMERA>
    <NODE tz="1">
      <VIEWER picture="https://picsum.photos/200" refresh="5" />
    </NODE>
  </CAMERA>
</AUGMENTATION>`,

  "viewer_local": `<AUGMENTATION>
  <CAMERA>
    <NODE tz="1">
      <VIEWER picture="/static-html/test-image.png" refresh="50" />
    </NODE>
  </CAMERA>
</AUGMENTATION>
`,

  "views": `<AUGMENTATION viewlist="v_main,v_detail" viewswitch="true" viewdisplay="false" version="550">
  <VALUESERVER predefined="{&quot;flag_on&quot;:true,&quot;flag_off&quot;:false}">
  </VALUESERVER>
  <CAMERA>
    <NODE tz="100" view="">
      <NODE view="v_main" collapse="" show="">
        <TEXT label="Main view" width="10" />
      </NODE>
      <NODE view="v_detail" collapse="" show="">
        <TEXT label="Detail view" width="10" />
      </NODE>
      <NODE view="v_main,v_detail" show="@anim:flag_on" collapse="">
        <TEXT label="Always both views" width="10" />
      </NODE>
      <NODE view="" show="@anim:flag_off" collapse="">
        <TEXT label="Hidden by flag" width="10" />
      </NODE>
      <NODE view="v_main" collapse="" show="">
        <MODEL file="planexy" texture="images/arrow.png">
          <LINK refer="@view:v_detail" w="0" h="0" d="1" />
        </MODEL>
      </NODE>
      <SWITCH w="2" h="2" d="0" on="true" onvalue="GO" offvalue="STOP">
        <TRANSMIT attribute="pressed" variable="cmd" transmitter="send" threshold="" />
      </SWITCH>
      <NODE ty="-20">
        <TEXT width="10">
          <METADATA fallback="en">
            <label>
              <en><![CDATA[From metadata]]></en>
              <xde><![CDATA[label]]></xde>
            </label>
          </METADATA>
        </TEXT>
      </NODE>
      <NODE tx="30" sx="10" sy="10" sz="10">
        <MODEL file="cube">
          <MATERIAL type="mask"/>
        </MODEL>
      </NODE>
      <NODE tx="-30" sx="5" sy="5" sz="5">
        <MODEL file="cube" texture="fdar_white" tint="#D50000" />
      </NODE>
    </NODE>
  </CAMERA>
</AUGMENTATION>
`,
};

module.exports = { SCENES };
