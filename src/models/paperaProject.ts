export interface PaperaProject {
	id: string;
	name: string;
}

export interface PaperaWorkflow {
	id: string;
	name: string;
}

export interface PaperaContentUnit {
	id: string;
	workflowId: string;
	title: string;
	revision?: number;
	lastChangedAt?: string;
}

export interface PaperaProjectContents {
	workflows: PaperaWorkflow[];
	contentUnits: PaperaContentUnit[];
}

export interface PaperaListedProject extends PaperaProjectContents {
	project: PaperaProject;
}
