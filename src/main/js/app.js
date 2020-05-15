'use strict';

const React = require('react');
const ReactDOM = require('react-dom');
const client = require('./client');
const when = require('when');
const follow = require('./follow'); // function to hop multiple links by "rel"
const stompClient = require('./websocket-listener');
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import ReactModal from 'react-modal';

const root = '/api';
let displayedEmployee = null;

const modalStyle = {
	content : {
		top                   : '50%',
		left                  : '50%',
		right                 : 'auto',
		bottom                : 'auto',
		marginRight           : '-50%',
		transform             : 'translate(-50%, -50%)'
	}
};

ReactModal.setAppElement('#react')
//or possibly createEmployee

class App extends React.Component {
	constructor(props) {
		super(props);
		this.state = {employees: [], attributes: [], page:1, pageSize: 20, links: {},
			loggedInManager: this.props.loggedInManager, showModal:false};
		this.updatePageSize = this.updatePageSize.bind(this);
		this.onCreate = this.onCreate.bind(this);
		this.onUpdate = this.onUpdate.bind(this);
		this.onDelete = this.onDelete.bind(this);
		this.onNavigate = this.onNavigate.bind(this);
		this.refreshCurrentPage = this.refreshCurrentPage.bind(this);
		this.refreshAndGoToLastPage = this.refreshAndGoToLastPage.bind(this);
		this.toggleOpen = this.toggleOpen.bind(this);
		this.handleNewEmpSubmit = this.handleNewEmpSubmit.bind(this);
	}

	toggleOpen(){
		this.setState(state=> ({
			showModal: !state.showModal
		}));
	}

	loadFromServer(pageSize){
		//first, grab the entries for whichever set appears on the page
		follow(client,root,[
			{rel:'employees',params:{size:pageSize}}
		]).then(employeeCollection => {
			//now we get the schema for the employee object, attributes and links, etc
			return client({
				method:'GET',
				path: employeeCollection.entity._links.profile.href,
				headers:{'Accept':'application/schema+json'}
			}).then(schema => {
				//Filter out unneeded JSON schema properties
				Object.keys(schema.entity.properties).forEach(function (property) {
					if ((schema.entity.properties[property].hasOwnProperty('format') &&
						schema.entity.properties[property].format === 'uri') ||
						schema.entity.properties[property].hasOwnProperty('$ref')) {
						delete schema.entity.properties[property];
					}
				});

				//set it into the schema so we can reference it later
				this.schema = schema.entity;
				this.links = employeeCollection.entity._links;
				return employeeCollection;
			});
		}).then(employeeCollection => {
			this.page = employeeCollection.entity.page;
			//now we do a separate get on each "self" href. This makes Spring Data put a version on each one
			return employeeCollection.entity._embedded.employees.map(employee =>
				client({
					method:'GET',
					path:employee._links.self.href
				})
			);
		}).then(employeePromises => {
			//wait for all the async to finish up
			return when.all(employeePromises);
		}).done(employees => {
			//set everything into state
			this.setState({
				page: this.page,
				employees:employees,
				attributes: Object.keys(this.schema.properties),
				pageSize:pageSize,
				links: this.links
			});
		});
	}

	handleNewEmpSubmit(e) {
		e.preventDefault();
		const newEmployee = {};
		this.state.attributes.forEach(attribute => {
			newEmployee[attribute] = ReactDOM.findDOMNode(this.refs[attribute]).value.trim();
		});
		this.onCreate(newEmployee);

		// clear out the dialog's inputs
		this.state.attributes.forEach(attribute => {
			ReactDOM.findDOMNode(this.refs[attribute]).value = '';
		});

		this.toggleOpen();
	}

	onCreate(newEmployee) {
		follow(client, root, ['employees']).then(response => {
			return client({
				method: 'POST',
				path: response.entity._links.self.href,
				entity: newEmployee,
				headers: {'Content-Type': 'application/json'}
			})
		})
	}

	onDelete(employee) {
		client({method: 'DELETE', path: employee.entity._links.self.href}).done(response => {
			ReactDOM.render(<BlankDiv />,document.getElementById('right-side'));
		},response => {
			if(response.status.code === 403){
				alert('DENIED: Get outta here with that wack mess');
			}
		});
	}

	onUpdate(employee, updatedEmployee) {
		if(employee.entity.manager.name === this.state.loggedInManager) {
			updatedEmployee["manager"] = employee.entity.manager;
			client({
				method: 'PUT',
				path: employee.entity._links.self.href,
				entity: updatedEmployee,
				headers: {
					'Content-Type': 'application/json',
					'If-Match': employee.headers.Etag
				}
			}).done(response => {
				// Websocket will handle the update
			}, response => {
				if (response.status.code === 403) {
					alert('DENIED: You are not authorized to update ' +
						employee.entity._links.self.href);
				}
				if (response.status.code === 412) {
					alert('DENIED: Unable to update ' + employee.entity._links.self.href + '. Your copy is stale. :(');
				}
			});
		} else {
			alert("You are not authorized to update");
		}
	}

	// tag::navigate[]
	onNavigate(navUri){
		client({
			method:'GET',
			path:navUri
		}).then(employeeCollection => {
			this.links = employeeCollection.entity._links;
			this.page = employeeCollection.page;
			return employeeCollection.entity._embedded.employees.map(employee =>
				client({
					method:'GET',
					path: employee._links.self.href
				})
			);
		}).then(employeePromises => {
			return when.all(employeePromises);
		}).done(employees => {
			this.setState({
				page: this.page,
				employees: employees,
				attributes: Object.keys(this.schema.properties),
				pageSize: this.state.pageSize,
				links: this.links
			});
		});
	}
	// end::navigate[]

	// tag::update-page-size[]
	updatePageSize(pageSize) {
		if (pageSize !== this.state.pageSize) {
			this.loadFromServer(pageSize);
		}
	}
	// end::update-page-size[]

	// tag::follow-1[]
	componentDidMount() {
		this.loadFromServer(this.state.pageSize);
		stompClient.register([
			{route: '/topic/newEmployee', callback: this.refreshCurrentPage},
			{route: '/topic/updateEmployee', callback: this.refreshCurrentPage},
			{route: '/topic/deleteEmployee', callback: this.refreshCurrentPage}
		])
	}

	refreshAndGoToLastPage(message){
		follow(client,root,[{
			rel:'employees',
			params:{
				size:this.state.pageSize,
				page:this.state.page.number
			}
		}]).done(response =>{
			if(response.entity._links.last !== undefined){
				this.onNavigate(response.entity._links.last.href);
			}else{
				this.onNavigate(response.entity._links.self.href);
			}
		})
	}

	refreshCurrentPage(message){
		follow(client,root,[{
			rel:'employees',
			params:{
				size:this.state.pageSize,
				page:this.state.page.number
			}
		}]).then(employeeCollection => {
			this.links = employeeCollection.entity._links;
			this.page = employeeCollection.entity.page;
			return employeeCollection.entity._embedded.employees.map(employee => {
				return client({
					method: 'GET',
					path: employee._links.self.href
				})
			});
		}).then(employeePromises => {
			return when.all(employeePromises);
		}).done(employees => {
			this.setState({
				page: this.page,
				employees: employees,
				attributes: Object.keys(this.schema.properties),
				pageSize: this.state.pageSize,
				links: this.links
			});
		});

		//refresh view pane
		if(displayedEmployee != null) {
			client({
				method: 'GET',
				path: displayedEmployee
			}).done(employee => {
				ReactDOM.render(<EmployeeDetails key={employee.entity._links.self.href}
												 employee={employee}
												 attributes={Object.keys(this.schema.properties)}
												 onUpdate={this.props.onUpdate}
												 onDelete={this.props.onDelete}
												 loggedInManager={this.props.loggedInManager}/>,
					document.getElementById('right-side'));
			}, response => {
				if (response.status.code === 404) {
					ReactDOM.render('The employee you were viewing is no longer available',
						document.getElementById('right-side'));
				}
			});
		}
	}

	render() {
		const newEmpInputs = this.state.attributes.map(attribute =>
			<p key={attribute}>
				<input type="text" placeholder={attribute} ref={attribute} className="field" aria-label={attribute}/>
			</p>
		);

		return (
			<Container fluid="md">
				<header id={'mu-hero'}>
				<Row>
					<Col lg={9}><span className={"mu-title"}><h1>Employee Central</h1></span></Col>
					<Col><MenuBar loggedInManager={this.state.loggedInManager} /></Col>
				</Row>
				</header>
				<Row>
					<Col>

							<EmployeeList employees={this.state.employees}
										  links={this.state.links}
										  pageSize={this.state.pageSize}
										  attributes={this.state.attributes}
										  onNavigate={this.onNavigate}
										  onUpdate={this.onUpdate}
										  onDelete={this.onDelete}
										  updatePageSize={this.updatePageSize}
										  loggedInManager={this.state.loggedInManager}/>
						<button onClick={this.toggleOpen} >New Employee</button>
						<ReactModal
							isOpen={this.state.showModal}
							contentLabel={"Employee Creation Modal"}
							onRequestClose={this.toggleOpen}
							style={modalStyle}>
							<div id="createEmployee" aria-label={'Create New Employee'}>
								<div>
									<h2>Create new employee</h2>
									<form>
										{newEmpInputs}
										<button onClick={this.handleNewEmpSubmit} aria-label={'Create'}>Create</button>
										<button onClick={this.toggleOpen} aria-label={'Cancel'}>Cancel</button>
									</form>
								</div>
							</div>
						</ReactModal>
						<button onClick={()=>{console.log(this.state)}}>Show State</button>
					</Col>
					<Col>
						<div id={'right-side'} >Select an Employee</div>
					</Col>
				</Row>
			</Container>

		)
	}
}

class BlankDiv extends React.Component{
	render(){
		return(
			<div id={'right-side'}>Select an Employee</div>
		)
	}
}

class MenuBar extends React.Component{
	constructor(props){
		super(props);
	}
	render(){
		return(
			<div className="dropdown">
				<button aria-label={'Menu'} className="dropbtn">{this.props.loggedInManager}</button>
				<div className="dropdown-content">
					<a href="#">Employees</a>
					<a href="#">Other Stuff</a>
					<a href="#">Log Out</a>
				</div>
			</div>
		)
	}
}

class EmployeeList extends React.Component {
	constructor(props) {
		super(props);
		this.handleInput = this.handleInput.bind(this);
		this.handleChange = this.handleChange.bind(this);
	}

	handleChange(event){
		client({
			method: 'GET',
			path: event.target.value
		}).then(employee =>{
			displayedEmployee = employee.entity._links.self.href;
			ReactDOM.render(<EmployeeDetails key={employee.entity._links.self.href}
											 employee={employee}
											 attributes={this.props.attributes}
											 onUpdate={this.props.onUpdate}
											 onDelete={this.props.onDelete}
											 loggedInManager={this.props.loggedInManager}/>,
				document.getElementById('right-side'));
		});
	}

	handleInput(e) {
		e.preventDefault();
		const pageSize = ReactDOM.findDOMNode(this.refs.pageSize).value;
		if (/^[0-9]+$/.test(pageSize)) {
			this.props.updatePageSize(pageSize);
		} else {
			ReactDOM.findDOMNode(this.refs.pageSize).value =
				pageSize.substring(0, pageSize.length - 1);
		}
	}
	render() {
		const employees = this.props.employees.map(employee =>
			<Employee key={employee.entity._links.self.href}
					  employee={employee}
					  attributes={this.props.attributes}
					  onUpdate={this.props.onUpdate}
					  onDelete={this.props.onDelete}
					  loggedInManager={this.props.loggedInManager}/>
		);

		return (
			<div>
				<select id={employees} size={20} multiple={false} onChange={this.handleChange}>
					{employees}
				</select>
			</div>
		)
	}
}

class EmployeeDetails extends React.Component {
	//expecting 'employee'
	constructor(props){
		super(props);
		this.state = {showUpdateModal:false};
		this.handleDelete = this.handleDelete.bind(this);
		this.handleUpdateSubmit = this.handleUpdateSubmit.bind(this);
		this.toggleUpdateModal = this.toggleUpdateModal.bind(this);
	}
	handleDelete() {
		this.props.onDelete(this.props.employee);
	}
	handleUpdateSubmit(e){
		e.preventDefault();
		const updatedEmployee = {};
		this.props.attributes.forEach(attribute => {
			updatedEmployee[attribute] = ReactDOM.findDOMNode(this.refs[attribute]).value.trim();
		});
		this.props.onUpdate(this.props.employee,updatedEmployee);
		this.toggleUpdateModal();
	}
	toggleUpdateModal(){
		this.setState(state=> ({
			showUpdateModal: !state.showUpdateModal
		}));
	}
	render(){
		const inputs = this.props.attributes.map(attribute =>
			<p key={this.props.employee.entity[attribute]}>
				<input type="text" placeholder={attribute}
					   defaultValue={this.props.employee.entity[attribute]} ref={attribute} className="field" />
			</p>
		);
		const dialogId = "updateEmployee-" + this.props.employee.entity._links.self.href;
		const isManagerCorrect = this.props.employee.entity.manager.name === this.props.loggedInManager;

		return(
			<div id={this.props.employee.entity.id} tabIndex={4}>
				<h2>Employee Details</h2>
				<dl>
					<dt id={'firstName'} tabIndex={'-1'}>First Name: </dt>
					<dd aria-labelledby={'firstName'}>{this.props.employee.entity.firstName}</dd>

					<dt id={'lastName' } tabIndex={'-1'}>Last Name: </dt>
					<dd aria-labelledby={'lastName'}>{this.props.employee.entity.lastName}</dd>

					<dt id={'description'} tabIndex={'-1'}>Description: </dt>
					<dd aria-labelledby={'description'}>{this.props.employee.entity.description}</dd>

					<span style={{display : isManagerCorrect ? 'block' : 'none', ariaHidden : isManagerCorrect ? 'false' : 'true'}}>
						<dt id={'updateDetails'} tabIndex={'-1'}>Update Details</dt>
						<dd aria-labelledby={'updateDetails'}>
							<button onClick={this.toggleUpdateModal}>Update Employee Details</button>
						<ReactModal
							isOpen={this.state.showUpdateModal}
							contentLabel={"Employee Update Modal"}
							onRequestClose={this.toggleUpdateModal}
							style={modalStyle}>
							<h2>Update Employee Details</h2>
							<div key={this.props.employee.entity._links.self.href}>
								<div id={dialogId} className="modalDialog">
									<div>
										<form>
											{inputs}
											<button onClick={this.handleUpdateSubmit}>Update</button>&nbsp;
											<button onClick={this.toggleUpdateModal}>Cancel</button>
										</form>
									</div>
								</div>
							</div>
						</ReactModal>
						</dd>

						<dt id={'deleteEmployee'} tabIndex={'-1'}>Delete Employee</dt>
						<dd aria-labelledby={'deleteEmployee'}><button onClick={this.handleDelete}>Delete</button></dd>
					</span>
				</dl>
			</div>
		)
	}
}

class Employee extends React.Component {
	constructor(props) {
		super(props);
	}
	render() {
		return (
			<option value={this.props.employee.entity._links.self.href}>
				{this.props.employee.entity.firstName + ' ' + this.props.employee.entity.lastName}
			</option>
		)
	}
}

ReactDOM.render(
	<App loggedInManager={document.getElementById('managername').innerHTML }/>,
	document.getElementById('react')
)