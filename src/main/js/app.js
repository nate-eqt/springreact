const React = require('react');
const ReactDOM = require('react-dom');
const client = require('./client');

class App extends React.Component {
    /*
    The common convention is to initialize state with all your attributes empty in the constructor.
    Then you look up data from the server by using componentDidMount and populating your attributes.
    From there on, updates can be driven by user action or other events.
    */
    constructor(props) {
        super(props);
        this.state = {employees: []};
    }

    componentDidMount(){
        //Fetches the employee list and sets it into state
        client({method: 'GET', path: '/api/employees'}).done(response => {
            this.setState({employees: response.entity._embedded.employees});
        });
    }

    render(){
        return(<EmployeeList employees = {this.state.employees}/>)
    }

}

class EmployeeList extends React.Component{
    render(){
        const employees = this.props.employees.map(employee =>
            //Below is a demonstration of HATEOAS in action when setting the employee key
            <Employee key={employee._links.self.href} employee={employee} />
        );
        return(
            <table>
                <thead>
                    <tr>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                {employees}
                </tbody>
            </table>
        )
    }
}

class Employee extends React.Component{
    render(){
        return (
            <tr>
                <td>{this.props.employee.firstName}</td>
                <td>{this.props.employee.lastName}</td>
                <td>{this.props.employee.description}</td>
            </tr>
        )
    }
}

ReactDOM.render(
	<App />,
	document.getElementById('react')
)