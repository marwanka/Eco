import React from 'react';
import './App.css';
import openSocket from 'socket.io-client';
import {LineChart, XAxis, Tooltip, CartesianGrid, Line} from 'recharts';
import {DropdownToggle, Dropdown, DropdownItem, DropdownMenu} from 'reactstrap';
const socket = openSocket(require('./config.json').api_ip)

export default class App extends React.Component {
  constructor() {
    super();

    this.state = { records: [], toggle: false, toggleC: false, city: "Город", cities: [], countries: [], country: "Страна" };
    this.toggleDropdown = this.toggleDropdown.bind(this);
    this.toggleDropdownC = this.toggleDropdownC.bind(this);
    this.setCity = this.setCity.bind(this);
    this.setContry = this.setCountry.bind(this);


    socket.emit('countries');
    setInterval(()=>{
      socket.emit('get', { offset: 0, limit: 10, city: this.state.city });
    }, 300000)

    socket.on('data', (data) => { this.setState({ records: data }); });
    socket.on('cities', (data) => { this.setState({ cities: data }); });
    socket.on('countries', (data) => { this.setState({ countries: data }); });
  }

  toggleDropdown() { this.setState({toggle: !this.state.toggle}); }
  toggleDropdownC() { this.setState({toggleC: !this.state.toggleC}); }
  setCity(city) { socket.emit('get', { offset: 0, limit: 10, city: city }); this.setState({city: city}); }
  setCountry(country) { socket.emit('cities', { country: this.state.country }); this.setState({country: country}); }

  render() {
    return (
      <div>
        <Dropdown isOpen={this.state.toggleC} toggle={this.toggleDropdownC}>
        <DropdownToggle caret>
          {this.state.country}
          </DropdownToggle>
        <DropdownMenu right>
          <DropdownItem header>Страны</DropdownItem>
          {this.state.countries.map((country, i) => {
            return (<DropdownItem onClick={()=>{this.setCountry(country);}}>{country}</DropdownItem>);
          })}
        </DropdownMenu>
      </Dropdown>
        <Dropdown isOpen={this.state.toggle} toggle={this.toggleDropdown}>
        <DropdownToggle caret>
          {this.state.city}
          </DropdownToggle>
        <DropdownMenu right>
          <DropdownItem header>Города</DropdownItem>
          {this.state.cities.map((city, i) => {
            return (<DropdownItem onClick={()=>{this.setCity(city);}}>{city}</DropdownItem>);
          })}
        </DropdownMenu>
      </Dropdown>
      <span>График экологии</span>
      <LineChart
        width={400}
        height={200}
        data={this.state.records}
        margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
        >
        <XAxis dataKey="citi" />
        <Tooltip />
        <CartesianGrid stroke="#f5f5f5" />
        <Line type="monotone" dataKey="temperature" stroke="#ff7300" yAxisId={0} />
        <Line type="monotone" dataKey="humidity" stroke="#387908" yAxisId={1} />
        <Line type="monotone" dataKey="pressure" stroke="#388909" yAxisId={2} />
      </LineChart>
      </div>
    )
  }

};
