
import {
  Accordion, AccordionDetails, AccordionSummary, AppBar, ButtonGroup, CircularProgress, Divider, FormControl, Grid, IconButton, makeStyles, MenuItem, Paper, Select,  TextField, Toolbar, Tooltip, Typography,
} from "@material-ui/core";
import DeleteIcon from "@material-ui/icons/Delete";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import FileCopyIcon from '@material-ui/icons/FileCopy';
import ListAltIcon from '@material-ui/icons/ListAlt';
import SaveIcon from '@material-ui/icons/Save';
import { Autocomplete } from '@material-ui/lab';
import jsYaml from "js-yaml";
import React, { useContext, useEffect, useRef, useState } from "react";
import { trueRandom } from "../../lib/trueRandom";
import { SchemaContext } from "../../utils/context/schemaSet";
import { getMeshProperties } from "../../utils/nameMapper";
import { isEmptyObj } from "../../utils/utils";
import { groupWorkloadByVersion } from "../../utils/workloadFilter";
import { createPatternFromConfig, getHumanReadablePatternServiceName, getPatternServiceName } from "../MesheryMeshInterface/helpers";
import LazyPatternServiceForm, { getWorkloadTraitAndType } from "../MesheryMeshInterface/LazyPatternServiceForm";
import PatternServiceForm from "../MesheryMeshInterface/PatternServiceForm";
import CodeEditor from "./CodeEditor";
import NameToIcon from "./NameToIcon";
import CustomBreadCrumb from "./CustomBreadCrumb";

const useStyles = makeStyles((theme) => ({
  backButton : {
    marginRight : theme.spacing(2),
  },
  appBar : {
    marginBottom : "16px",
    backgroundColor : "#fff",
    borderRadius : "8px"
  },
  yamlDialogTitle : {
    display : "flex",
    alignItems : "center"
  },
  yamlDialogTitleText : {
    flexGrow : 1
  },
  fullScreenCodeMirror : {
    height : '100%',
    '& .CodeMirror' : {
      minHeight : "300px",
      height : '100%',
    }
  },
  formCtrl : {
    width : "60px",
    minWidth : "60px",
    maxWidth : "60px",
    marginRight : 8,
  },
  autoComplete : {
    width : "120px",
    minWidth : "120px",
    maxWidth : 120,
  },
  autoComplete2 : {
    width : 250,
    marginLeft : 16,
    marginRight : "auto",
    padding : 0,
    // "& .MuiAutocomplete-inputRoot" : {
    //   padding : 0
    // },
    // '& .MuiInputBase-input' : {

    // }
  },
  btngroup : {
    marginLeft : "auto",
    overflowX : "auto",
    overflowY : "hidden"
  },
  paper : {
    backgroundColor : "#fcfcfc",
    padding : 8,
    height : "100%",
  },
}));

function PatternConfiguratorComponent({ pattern, onSubmit, show : setSelectedPattern }) {
  const { workloadTraitSet, meshWorkloads } = useContext(SchemaContext);
  const [workloadTraitsSet, setWorkloadTraitsSet] = useState(workloadTraitSet);
  const [deployServiceConfig, setDeployServiceConfig] = useState(getPatternJson() || {});
  const [yaml, setYaml] = useState(pattern.pattern_file);
  const [selectedMeshType, setSelectedMeshType] = useState("core");
  const [selectedVersionMesh, setSelectedVersionMesh] = useState();
  const [selectedVersion, setSelectedVersion] = useState("");
  const [briefCrsInformations, setBriefCrsInformations] = useState(null);
  const [activeForm, setActiveForm] = useState();
  const [viewType, setViewType] = useState("list");
  const [activeCR, setActiveCR] = useState({});
  const classes = useStyles();
  const reference = useRef({});

  useEffect(() => {
    if (workloadTraitSet != workloadTraitsSet) {
      setWorkloadTraitsSet(workloadTraitSet);
    }
  }, [workloadTraitSet]);

  useEffect(() => {
    // core is not versioned
    if (selectedMeshType == "core") {
      setSelectedVersionMesh(null);
    } else {
      const meshVersionsWithDetails = groupWlByVersion();
      setSelectedVersionMesh(meshVersionsWithDetails);
    }
    setViewType("list");
    setActiveForm(null);
  }, [selectedMeshType]);

  useEffect(() => {
    if (selectedVersionMesh) {
      setSelectedVersion(Object.keys(selectedVersionMesh).sort().reverse()[0]);
    }
  }, [selectedVersionMesh]);

  useEffect(() => {
    if (selectedVersion) {
      const crsBriefs = getFormBriefInformationKeys()
      setBriefCrsInformations(crsBriefs);
      setActivePatternWithRefinedSchema(selectedVersionMesh?.[selectedVersion]
        ?.sort((a, b) => (getPatternServiceName(a.workload) < getPatternServiceName(b.workload) ? -1 : 1))[0]);
      setActiveCR(crsBriefs[0])
    }
  }, [selectedVersion]);

  useEffect(() => {
    if (!isEmptyObj(activeCR)) {
      let activeSchema;
      if (selectedMeshType === "core" || selectedMeshType === "kubernetes") {
        activeSchema = meshWorkloads[selectedMeshType]
          .find(schema => schema?.workload?.metadata?.["display.ui.meshery.io/name"] === activeCR.name);
      } else {
        activeSchema = selectedVersionMesh?.[selectedVersion]
          .find(schema => schema?.workload?.oam_definition?.metadata?.name === activeCR.name);
      }
      setActivePatternWithRefinedSchema(activeSchema);
    }
  }, [activeCR])


  function groupWlByVersion() {
    const mfw = meshWorkloads[selectedMeshType];
    return mfw ? groupWorkloadByVersion(mfw) : {};
  }


  function getPatternJson() {
    const patternString = pattern.pattern_file;
    // @ts-ignore
    return jsYaml.load(patternString).services;
  }

  function getPatternKey(cfg) {
    return Object.keys(cfg?.services)?.[0] || undefined;
  }

  function resetSelectedPattern() {
    return { show : false, pattern : null };
  }

  /**
   * get keys and mapping to the correct icons and colors
   * for all the CRDs available in any SM
   * @returns {{name: String, icon: React.ReactElement, color: String}}
   */
  function getFormBriefInformationKeys() {
    if (selectedMeshType === "core" || selectedMeshType === "kubernetes") {
      return meshWorkloads[selectedMeshType].map(mwl => {
        const name = mwl?.workload?.metadata?.["display.ui.meshery.io/name"];
        return {
          name,
          icon : <NameToIcon name={name.split(".")[0]} color={getMeshProperties(selectedMeshType).color} />,
          readableName : getHumanReadablePatternServiceName(mwl?.workload) };
      });
    }
    return selectedVersionMesh
      ?.[selectedVersion]
      ?.sort((a, b) => (getPatternServiceName(a.workload) < getPatternServiceName(b.workload) ? -1 : 1))
      .map(item => {
        const name = item.workload?.oam_definition?.metadata?.name;
        return {
          name,
          icon : <NameToIcon name={name.split(".")[0]} color={getMeshProperties(selectedMeshType).color} />,
          readableName : getHumanReadablePatternServiceName(item?.workload) };
      });
  }

  const handleSubmit = (cfg, patternName) => {
    console.log("submitted", { cfg, patternName });
    const key = getPatternKey(cfg);
    handleCodeEditorYamlChange({ ...deployServiceConfig, [key] : cfg?.services?.[key] });
    if (key) setDeployServiceConfig({ ...deployServiceConfig, [key] : cfg?.services?.[key] });
  };

  const handleSettingsChange = (schemaSet) => () => {
    const config = createPatternFromConfig({
      [getPatternServiceName(schemaSet)] : {
        // @ts-ignore
        settings : reference.current?.getSettings(),
        // @ts-ignore
        traits : reference.current?.getTraits()
      }
    }, "default", true);

    handleChangeData(config, "");
  };

  const handleChangeData = (cfg, patternName) => {
    console.log(patternName);
    const key = getPatternKey(cfg);
    handleCodeEditorYamlChange({ ...deployServiceConfig, [getPatternKey(cfg)] : cfg?.services?.[key] });
    if (key)
      setDeployServiceConfig({ ...deployServiceConfig, [getPatternKey(cfg)] : cfg?.services?.[key] });
  };

  const handleDelete = (cfg, patternName) => {
    console.log("deleted", cfg);
    const newCfg = workloadTraitsSet?.filter(schema => schema.workload.title !== patternName);
    setWorkloadTraitsSet(newCfg);
  };

  const handleCodeEditorYamlChange = (cfg) => {
    const deployConfig = {};
    deployConfig.name = pattern.name;
    deployConfig.services = cfg;
    const deployConfigYaml = jsYaml.dump(deployConfig);
    setYaml(deployConfigYaml);
  };

  function handleSubmitFinalPattern(yaml, id, name, action) {
    console.log("submitting a new pattern", yaml)
    onSubmit(yaml, id, name, action);
    setSelectedPattern(resetSelectedPattern()); // Remove selected pattern
  }

  const ns = "default";

  function saveCodeEditorChanges(data) {
    setYaml(data.valueOf().getValue());
  }

  function insertPattern(workload) {
    const attrName = getPatternServiceName(workload);
    var returnValue = {};
    Object.keys(deployServiceConfig).find(key => {
      if (deployServiceConfig[key]['type'] === attrName) {
        returnValue = deployServiceConfig[key];
        return true;
      }
    });

    return returnValue;
  }

  function getMeshOptions() {
    console.log({ meshWorkloads });
    return meshWorkloads ? Object.keys(meshWorkloads) : [];
  }

  function handleMeshSelection(event) {
    setSelectedMeshType(event.target.value);
  }

  function handleVersionChange(_, value) {
    setSelectedVersion(value);
  }

  async function setActivePatternWithRefinedSchema(schema) {
    const refinedSchema = await getWorkloadTraitAndType(schema);
    console.log("refined Schema", refinedSchema)
    setActiveForm(refinedSchema);
  }

  function toggleView() {
    if (viewType == "list") {
      if (isEmptyObj(activeForm)) {
        // core resources are handled sepaeratrly since they are not versioned
        setBriefCrsInformations(getFormBriefInformationKeys());
        if (selectedMeshType === "core" || selectedMeshType === "kubernetes") {
          setActivePatternWithRefinedSchema(meshWorkloads[selectedMeshType]
            ?.sort((a, b) => (getPatternServiceName(a.workload) < getPatternServiceName(b.workload) ? -1 : 1))[0]);
        } else {
          setActivePatternWithRefinedSchema(selectedVersionMesh?.[selectedVersion]
            ?.sort((a, b) => (getPatternServiceName(a.workload) < getPatternServiceName(b.workload) ? -1 : 1))[0]);
        }
      }
      setViewType("form");
    } else {
      setViewType("list");
    }
  }

  if (isEmptyObj(workloadTraitsSet)) return <CircularProgress />;

  return (
    <>
      <AppBar position="static" className={classes.appBar} elevation={0}>
        <Toolbar className={classes.toolbar}>
          <FormControl className={classes.formCtrl}>
            <Select
              labelId="service-mesh-selector"
              id="service-mesh-selector"
              value={selectedMeshType}
              onChange={handleMeshSelection}
              disableUnderline
            >
              {getMeshOptions().map(item => {
                const details = getMeshProperties(item);
                return (
                  <MenuItem key={details.name} value={details.name}>
                    <img src={details.img} height="32px" />
                  </MenuItem>);
              })}
            </Select>
          </FormControl>
          {
            selectedVersion && selectedVersionMesh &&
            <Autocomplete
              options={Object.keys(selectedVersionMesh).sort().reverse()}
              renderInput={(params) => <TextField {...params} variant="outlined" label="Version" />}
              value={selectedVersion}
              onChange={handleVersionChange}
              className={classes.autoComplete}
              disableClearable
            />
          }
          {
            viewType === "form" && briefCrsInformations && briefCrsInformations.length > 0
            && <Autocomplete
              className={classes.autoComplete2}
              disableClearable
              value={activeCR}
              options={briefCrsInformations}
              getOptionLabel={(option) => option.readableName}
              onChange={(_, newVal) => {
                setActiveCR(newVal)
              }}
              renderOption={option => {
                return (
                  <>
                    <IconButton color="primary">
                      {option.icon}
                    </IconButton>
                    {option.name}
                  </>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  label="Configure"
                  placeholder={selectedMeshType}
                />
              )}
            />
          }
          <ButtonGroup
            disableFocusRipple
            disableElevation
            className={classes.btngroup}
          >
            {/* {
              selectedMeshType === "core" &&
              meshWorkloads["core"]
                ?.sort((a, b) => (getPatternServiceName(a.workload) < getPatternServiceName(b.workload) ? -1 : 1))
                .map((s) => {
                  const name = getTooltipTitleForIcons(s)
                  return name === activeForm?.workload?.title
                    ? <NameToIcon name={name} action={() => setActivePatternWithRefinedSchema(s)} color={getMeshProperties(selectedMeshType).color} />
                    : <NameToIcon name={name} action={() => setActivePatternWithRefinedSchema(s)} />
                })
            }
            {selectedVersionMesh && selectedVersionMesh?.[selectedVersion]
              ?.sort((a, b) => (getPatternServiceName(a.workload) < getPatternServiceName(b.workload) ? -1 : 1))
              .map((s) => {
                const name = getTooltipTitleForIcons(s)
                return name === activeForm?.workload["object-type"]
                  ? <NameToIcon name={name} action={() => setActivePatternWithRefinedSchema(s)} color={getMeshProperties(selectedMeshType).color} />
                  : <NameToIcon name={name} action={() => setActivePatternWithRefinedSchema(s)} />
              })
            } */}
            <Divider
              orientation="vertical"
            />
          </ButtonGroup>

          <Tooltip title="Save Pattern as New File">
            <IconButton
              aria-label="Save"
              color="primary"
              onClick={() => handleSubmitFinalPattern(yaml, "", `meshery_${Math.floor(trueRandom() * 100)}`, "upload")}
            >
              <FileCopyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Update Pattern">
            <IconButton
              aria-label="Update"
              color="primary"
              onClick={() => handleSubmitFinalPattern(yaml, pattern.id, pattern.name, "update")}
            >
              <SaveIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Pattern">
            <IconButton
              aria-label="Delete"
              color="primary"
              onClick={() => handleSubmitFinalPattern(yaml, pattern.id, pattern.name, "delete")}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle View">
            <IconButton color="primary" onClick={toggleView}>
              <ListAltIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Grid container spacing={3}>
        {
          // active Form is used to show a only one RJSF form on the screen
          viewType === "form" && activeForm
            ? (
              <Grid item xs={12} md={6}>
                <Paper className={classes.paper} elevation={0}>
                  <PatternServiceForm
                    schemaSet={activeForm}
                    jsonSchema={activeForm.workload}
                    formData={insertPattern(activeForm.workload)}
                    onSettingsChange={handleSettingsChange(activeForm.workload)}
                    onSubmit={(val) => handleSubmit(val, pattern.name)}
                    onDelete={(val) => handleDelete(val, pattern.name)}
                    namespace={ns}
                    reference={reference}
                    scroll
                  />
                </Paper>
              </Grid>
            ) : (
              <Grid item xs={12} md={6}>
                {
                  (selectedMeshType === "core" || selectedMeshType === "kubernetes")
                  && meshWorkloads[selectedMeshType]
                    ?.filter((s) => s.type !== "addon")
                    .sort((a, b) => (getPatternServiceName(a.workload) < getPatternServiceName(b.workload) ? -1 : 1))
                    .map((s, i) => (
                      <div style={{ marginBottom : "0.5rem" }} key={`svc-form-${i}`} >
                        <LazyPatternServiceForm
                          schemaSet={s}
                          formData={insertPattern(s.workload)}
                          onSettingsChange={handleSettingsChange(s.workload)}
                          onSubmit={(val) => handleSubmit(val, pattern.name)}
                          onDelete={(val) => handleDelete(val, pattern.name)}
                          namespace={ns}
                          reference={reference}
                        />
                      </div>))
                }
                {selectedVersionMesh && selectedVersionMesh?.[selectedVersion]
                  ?.filter((s) => s.type !== "addon")
                  .sort((a, b) => (getPatternServiceName(a.workload) < getPatternServiceName(b.workload) ? -1 : 1))
                  .map((s, i) => (
                    <div style={{ marginBottom : "0.5rem" }} key={`svc-form-${i}`} >
                      <LazyPatternServiceForm
                        schemaSet={s}
                        formData={insertPattern(s.workload)}
                        onSettingsChange={handleSettingsChange(s.workload)}
                        onSubmit={(val) => handleSubmit(val, pattern.name)}
                        onDelete={(val) => handleDelete(val, pattern.name)}
                        namespace={ns}
                        reference={reference}
                      />
                    </div>))}
                <Accordion elevation={0} style={{ width : '100%' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6">
                      Configure Addons
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {selectedVersionMesh && selectedVersionMesh?.[selectedVersion]
                      ?.filter((s) => s.type === "addon")
                      .sort((a, b) => (getPatternServiceName(a.workload) < getPatternServiceName(b.workload) ? -1 : 1))
                      .map((s, i) => (
                        <Grid item key={`svc-form-addons-${i}`}>
                          <LazyPatternServiceForm
                            formData={deployServiceConfig[s.workload?.title]}
                            onSettingsChange={handleSettingsChange(s.workload)}
                            schemaSet={s}
                            onSubmit={handleSubmit}
                            onDelete={handleDelete}
                            namespace={ns}
                            reference={reference}
                          />
                        </Grid>
                      ))}
                  </AccordionDetails>
                </Accordion>
              </Grid>)
        }
        <Grid item xs={12} md={6} >
          <CodeEditor yaml={yaml} saveCodeEditorChanges={saveCodeEditorChanges} />
        </Grid>
      </Grid>
      <CustomBreadCrumb
        title={pattern.name}
        onBack={() => setSelectedPattern(resetSelectedPattern())}
      />
    </>
  );
}

export default PatternConfiguratorComponent;

